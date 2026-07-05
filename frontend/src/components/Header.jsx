function Header({
  searchTerm,
  onSearchChange,
  cartItemCount,
  onOpenOrders
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          EM
        </span>
        <div>
          <p className="brand-kicker">Akıllı market</p>
          <h1>E-Market Smart Basket</h1>
        </div>
      </div>

      <label className="search-box">
        <span>Ürün ara</span>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Domates, peynir, süt..."
        />
      </label>

      <div className="header-actions">
        <button className="orders-button" type="button" onClick={onOpenOrders}>
          Siparişlerim
        </button>
        <div className="header-cart" aria-label="Sepetteki ürün adedi">
          <strong>{cartItemCount}</strong>
          <span>ürün</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
