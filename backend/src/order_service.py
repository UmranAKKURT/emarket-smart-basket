from __future__ import annotations

from typing import Any

from src.repository import OrderRepository, ProductRepository
from src.validation import (
    MAX_ITEM_QUANTITY,
    MAX_PAGE_LIMIT,
    MIN_ITEM_QUANTITY,
    MIN_PAGE_LIMIT,
)


class OrderServiceError(Exception):
    """Sipariş servisindeki beklenmeyen hataların temel sınıfı."""


class InvalidOrderError(OrderServiceError):
    """Sipariş verisi iş kurallarına uymadığında yükseltilir."""


class ProductNotFoundError(OrderServiceError):
    """Siparişte bulunamayan bir ürün olduğunda yükseltilir."""


class OrderNotFoundError(OrderServiceError):
    """Sipariş bulunamadığında veya kullanıcıya ait olmadığında yükseltilir."""


class OrderService:
    """Sipariş doğrulama ve oluşturma akışını yöneten servis."""

    def __init__(
        self,
        product_repository: ProductRepository,
        order_repository: OrderRepository,
    ) -> None:
        self.product_repository = product_repository
        self.order_repository = order_repository

    def create_order(
        self,
        user_id: int,
        items: list[dict[str, int]],
    ) -> dict[str, Any]:
        self._validate_user_id(user_id)

        if not isinstance(items, list) or not items:
            raise InvalidOrderError("Sipariş en az bir ürün içermelidir.")

        merged_items = self._validate_and_merge_items(items)
        self._validate_products_exist(list(merged_items))

        order_id = self.order_repository.create_order(
            user_id=user_id,
            items=[
                {"product_id": product_id, "quantity": quantity}
                for product_id, quantity in merged_items.items()
            ],
        )
        summary = self.order_repository.get_order_summary(order_id)

        if summary is None:
            raise OrderServiceError("Oluşturulan sipariş özeti alınamadı.")

        return summary

    def get_user_orders(
        self,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
    ) -> dict[str, Any]:
        self._validate_user_id(user_id)

        self._validate_integer_range(
            name="limit",
            value=limit,
            minimum=MIN_PAGE_LIMIT,
            maximum=MAX_PAGE_LIMIT,
        )

        if isinstance(offset, bool) or not isinstance(offset, int) or offset < 0:
            raise InvalidOrderError("offset sıfır veya daha büyük olmalıdır.")

        return {
            "user_id": user_id,
            "total": self.order_repository.count_orders_by_user(user_id),
            "limit": limit,
            "offset": offset,
            "orders": self.order_repository.get_orders_by_user(
                user_id=user_id,
                limit=limit,
                offset=offset,
            ),
        }

    def get_user_order_detail(
        self,
        user_id: int,
        order_id: int,
    ) -> dict[str, Any]:
        self._validate_user_id(user_id)

        self._validate_positive_integer("order_id", order_id)

        summary = self.order_repository.get_order_summary_for_user(
            order_id=order_id,
            user_id=user_id,
        )

        if summary is None:
            raise OrderNotFoundError(
                "Sipariş bulunamadı veya bu kullanıcıya ait değil."
            )

        return summary

    @staticmethod
    def _validate_user_id(user_id: int) -> None:
        OrderService._validate_positive_integer("user_id", user_id)

    @staticmethod
    def _validate_positive_integer(name: str, value: int) -> None:
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise InvalidOrderError(
                f"{name} sıfırdan büyük bir tam sayı olmalıdır."
            )

    @staticmethod
    def _validate_integer_range(
        name: str,
        value: int,
        minimum: int,
        maximum: int,
    ) -> None:
        if (
            isinstance(value, bool)
            or not isinstance(value, int)
            or not minimum <= value <= maximum
        ):
            raise InvalidOrderError(
                f"{name} {minimum} ile {maximum} arasında olmalıdır."
            )

    def _validate_and_merge_items(
        self,
        items: list[dict[str, int]],
    ) -> dict[int, int]:
        merged_items: dict[int, int] = {}

        for item in items:
            if not isinstance(item, dict):
                raise InvalidOrderError("Sipariş kalemleri nesne olmalıdır.")

            product_id = item.get("product_id")
            quantity = item.get("quantity")

            self._validate_positive_integer("product_id", product_id)
            self._validate_integer_range(
                name="quantity",
                value=quantity,
                minimum=MIN_ITEM_QUANTITY,
                maximum=MAX_ITEM_QUANTITY,
            )

            merged_quantity = merged_items.get(product_id, 0) + quantity
            if merged_quantity > MAX_ITEM_QUANTITY:
                raise InvalidOrderError(
                    f"{product_id} id değerli ürünün toplam quantity değeri "
                    f"{MAX_ITEM_QUANTITY}'yi aşamaz."
                )

            merged_items[product_id] = merged_quantity

        return merged_items

    def _validate_products_exist(self, product_ids: list[int]) -> None:
        products = self.product_repository.get_products_by_ids(product_ids)
        existing_product_ids = {int(product["id"]) for product in products}
        missing_product_ids = sorted(set(product_ids) - existing_product_ids)

        if missing_product_ids:
            missing_text = ", ".join(
                str(product_id) for product_id in missing_product_ids
            )
            raise ProductNotFoundError(
                f"Bulunamayan ürün id değerleri: {missing_text}"
            )
