from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.db_helper import EMarketDBHelper


class AuthRepository:
    def __init__(self, db_helper: EMarketDBHelper) -> None:
        self.db_helper = db_helper

    @staticmethod
    def _dict(row: Any) -> dict[str, Any] | None:
        return dict(row) if row is not None else None

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                "SELECT * FROM users WHERE email = ?;", (email,)
            ).fetchone()
        return self._dict(row)

    def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                "SELECT * FROM users WHERE id = ?;", (user_id,)
            ).fetchone()
        return self._dict(row)

    def create_user(
        self,
        email: str,
        password_hash: str,
        role: str,
        is_active: bool,
    ) -> int:
        with self.db_helper.get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (email, password_hash, role, is_active, created_at)
                VALUES (?, ?, ?, ?, ?);
                """,
                (
                    email,
                    password_hash,
                    role,
                    int(is_active),
                    datetime.now(timezone.utc).isoformat(timespec="seconds"),
                ),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def update_password(self, user_id: int, password_hash: str) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?;",
                (password_hash, user_id),
            )
            connection.commit()

    def update_last_login(self, user_id: int, timestamp: str) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?;",
                (timestamp, user_id),
            )
            connection.commit()

    def record_failed_login(
        self,
        user_id: int,
        failed_attempts: int,
        locked_until: str | None,
    ) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                """
                UPDATE users
                SET failed_login_attempts = ?, locked_until = ?
                WHERE id = ?;
                """,
                (failed_attempts, locked_until, user_id),
            )
            connection.commit()

    def reset_failed_login(self, user_id: int) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                "UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?;",
                (user_id,),
            )
            connection.commit()

    def create_session(self, **values: Any) -> int:
        with self.db_helper.get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO admin_sessions
                    (user_id, token_hash, csrf_token_hash, created_at, expires_at,
                     last_seen_at, user_agent, ip_address)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    values["user_id"],
                    values["token_hash"],
                    values["csrf_token_hash"],
                    values["created_at"],
                    values["expires_at"],
                    values.get("last_seen_at"),
                    values.get("user_agent"),
                    values.get("ip_address"),
                ),
            )
            connection.commit()
            return int(cursor.lastrowid)

    def get_active_session_by_token_hash(
        self,
        token_hash: str,
    ) -> dict[str, Any] | None:
        with self.db_helper.get_connection() as connection:
            row = connection.execute(
                """
                SELECT s.*, u.email, u.role, u.is_active, u.locked_until,
                       u.created_at AS user_created_at, u.last_login_at
                FROM admin_sessions AS s
                INNER JOIN users AS u ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.revoked_at IS NULL;
                """,
                (token_hash,),
            ).fetchone()
        return self._dict(row)

    def revoke_session(self, token_hash: str, revoked_at: str) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                "UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ?;",
                (revoked_at, token_hash),
            )
            connection.commit()

    def revoke_all_user_sessions(self, user_id: int, revoked_at: str) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                """
                UPDATE admin_sessions
                SET revoked_at = ?
                WHERE user_id = ? AND revoked_at IS NULL;
                """,
                (revoked_at, user_id),
            )
            connection.commit()

    def touch_session(self, token_hash: str, last_seen_at: str) -> None:
        with self.db_helper.get_connection() as connection:
            connection.execute(
                "UPDATE admin_sessions SET last_seen_at = ? WHERE token_hash = ?;",
                (last_seen_at, token_hash),
            )
            connection.commit()

    def delete_expired_sessions(self, now: str) -> int:
        with self.db_helper.get_connection() as connection:
            cursor = connection.execute(
                "DELETE FROM admin_sessions WHERE expires_at <= ?;",
                (now,),
            )
            connection.commit()
            return int(cursor.rowcount)
