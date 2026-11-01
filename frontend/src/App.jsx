import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addStock,
  createProduct,
  deleteProduct,
  fetchDashboard,
  fetchMovements,
  fetchProducts,
  getErrorMessage,
  removeStock,
  updateProduct,
} from "./api.js";

const money = (amount) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(amount ?? 0);
const dateTime = (value) => new Date(value).toLocaleString();
const navigation = [
  { id: "dashboard", label: "Dashboard", icon: "bi-grid-1x2" },
  { id: "products", label: "Products", icon: "bi-box-seam" },
  { id: "stock", label: "Stock control", icon: "bi-arrow-left-right" },
  { id: "history", label: "Movement history", icon: "bi-clock-history" },
];

function App() {
  const [page, setPage] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [movements, setMovements] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);
  const notify = useCallback((kind, message) => {
    setNotice({ kind, message });
    window.setTimeout(() => setNotice(null), 4200);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetchProducts(search),
      fetchDashboard(),
      fetchMovements(),
    ])
      .then(([nextProducts, nextDashboard, nextMovements]) => {
        if (!active) return;
        setProducts(nextProducts);
        setDashboard(nextDashboard);
        setMovements(nextMovements);
      })
      .catch((error) => {
        if (active) notify("danger", getErrorMessage(error));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [search, refreshKey, notify]);

  const runAction = async (action, successMessage) => {
    try {
      await action();
      notify("success", successMessage);
      refresh();
      return true;
    } catch (error) {
      notify("danger", getErrorMessage(error));
      return false;
    }
  };

  const saveProduct = async (values) => {
    const saved = editing
      ? await updateProduct(editing.id, { ...values, quantity: editing.quantity })
      : await createProduct({ ...values, quantity: 0 });
    setEditing(null);
    setPage("products");
    notify("success", editing ? "Product updated." : "Product created.");
    refresh();
    return saved;
  };

  const startAddProduct = () => {
    setEditing(null);
    setPage("product-form");
  };

  const editProduct = (product) => {
    setEditing(product);
    setPage("product-form");
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}? Products with movement history cannot be deleted.`)) return;
    await runAction(() => deleteProduct(product.id), "Product deleted.");
  };

  const handleStock = async (data, direction) => {
    const action = direction === "IN" ? addStock : removeStock;
    return runAction(() => action(data), direction === "IN" ? "Stock added successfully." : "Stock removed successfully.");
  };

  const pageTitle = useMemo(() => {
    if (page === "product-form") return editing ? "Edit product" : "Add product";
    return navigation.find((item) => item.id === page)?.label || "Dashboard";
  }, [editing, page]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><i className="bi bi-boxes" /></div>
          <div><strong>Stockroom</strong><span>INVENTORY CONSOLE</span></div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav className="side-nav">
          {navigation.map((item) => (
            <button key={item.id} className={page === item.id ? "nav-link active" : "nav-link"} onClick={() => setPage(item.id)}>
              <i className={`bi ${item.icon}`} /><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="status-dot" /> Inventory system online
          <small>Stock Management System</small>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><i className="bi bi-boxes" /> Stockroom</div>
          <div>
            <div className="eyebrow">INVENTORY MANAGEMENT</div>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <span className="connection-pill"><span className="status-dot" /> Live inventory</span>
            {page === "products" && <button className="btn btn-primary" onClick={startAddProduct}><i className="bi bi-plus-lg me-2" />Add product</button>}
          </div>
        </header>

        <div className="content">
          {notice && <div className={`alert alert-${notice.kind} alert-dismissible fade show`} role="alert">
            {notice.message}<button className="btn-close" aria-label="Close" onClick={() => setNotice(null)} />
          </div>}
          {loading && <div className="loading-line"><span /> Loading inventory…</div>}
          {page === "dashboard" && <DashboardPage summary={dashboard} movements={movements} onNavigate={setPage} />}
          {page === "products" && <ProductsPage products={products} search={search} setSearch={setSearch} onEdit={editProduct} onDelete={removeProduct} />}
          {page === "product-form" && <ProductForm product={editing} onCancel={() => setPage("products")} onSave={saveProduct} onError={(error) => notify("danger", getErrorMessage(error))} />}
          {page === "stock" && <StockPage products={products} onSubmit={handleStock} />}
          {page === "history" && <MovementPage movements={movements} />}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({ summary, movements, onNavigate }) {
  const stats = [
    { title: "Total products", value: summary?.totalProducts ?? 0, icon: "bi-box-seam", tone: "blue", footer: "Unique items in catalog" },
    { title: "Units in stock", value: summary?.totalStockQuantity ?? 0, icon: "bi-stack", tone: "violet", footer: "Across all products" },
    { title: "Low stock", value: summary?.lowStockProducts ?? 0, icon: "bi-exclamation-triangle", tone: "amber", footer: "At or below reorder level" },
    { title: "Out of stock", value: summary?.outOfStockProducts ?? 0, icon: "bi-inbox", tone: "rose", footer: "Products needing replenishment" },
  ];
  return <>
    <div className="welcome-row">
      <div><h2>Inventory overview</h2><p>A live snapshot of your stockroom and recent activity.</p></div>
      <button className="btn btn-outline-secondary" onClick={() => onNavigate("history")}><i className="bi bi-clock-history me-2" />View activity</button>
    </div>
    <div className="row g-3 stats-grid">
      {stats.map((stat) => <div className="col-12 col-sm-6 col-xl-3" key={stat.title}>
        <div className="stat-card">
          <div className={`stat-icon ${stat.tone}`}><i className={`bi ${stat.icon}`} /></div>
          <div className="stat-title">{stat.title}</div>
          <div className="stat-value">{Number(stat.value).toLocaleString()}</div>
          <div className="stat-footer">{stat.footer}</div>
        </div>
      </div>)}
    </div>
    <section className="panel-card mt-4">
      <div className="section-heading">
        <div><h3>Recent movements</h3><p>Your latest stock activity</p></div>
        <button className="text-action" onClick={() => onNavigate("history")}>View all <i className="bi bi-arrow-up-right" /></button>
      </div>
      <MovementTable movements={(summary?.recentMovements || movements).slice(0, 6)} />
    </section>
  </>;
}

function ProductsPage({ products, search, setSearch, onEdit, onDelete }) {
  return <section className="panel-card">
    <div className="section-heading product-heading">
      <div><h3>Product catalog</h3><p>Manage product details and monitor stock levels.</p></div>
      <div className="search-field"><i className="bi bi-search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or code…" aria-label="Search products" /></div>
    </div>
    {products.length ? <div className="table-responsive"><table className="table align-middle data-table">
      <thead><tr><th>PRODUCT</th><th>CODE</th><th>UNIT PRICE</th><th>ON HAND</th><th>STATUS</th><th className="text-end">ACTIONS</th></tr></thead>
      <tbody>{products.map((product) => <tr key={product.id}>
        <td><div className="product-cell"><span className="product-avatar">{product.name.slice(0, 1).toUpperCase()}</span><div><strong>{product.name}</strong><small>{product.description || "No description"}</small></div></div></td>
        <td><span className="code-chip">{product.code}</span></td><td>{money(product.price)}</td><td className="quantity-cell">{product.quantity.toLocaleString()}</td>
        <td><StockBadge product={product} /></td>
        <td className="text-end"><button className="icon-button" title="Edit product" onClick={() => onEdit(product)}><i className="bi bi-pencil" /></button><button className="icon-button danger-hover" title="Delete product" onClick={() => onDelete(product)}><i className="bi bi-trash3" /></button></td>
      </tr>)}</tbody>
    </table></div> : <EmptyState title="No products found" message={search ? "Try a different product name or code." : "Add your first product to begin managing inventory."} />}
    <div className="table-footnote">{products.length} product{products.length === 1 ? "" : "s"} shown</div>
  </section>;
}

function ProductForm({ product, onCancel, onSave, onError }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    code: product?.code || "",
    description: product?.description || "",
    price: product?.price ?? "",
  });
  const [saving, setSaving] = useState(false);
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, price: Number(form.price) });
    } catch (error) {
      onError(error);
    } finally {
      setSaving(false);
    }
  };
  return <section className="panel-card form-card">
    <div className="section-heading"><div><h3>{product ? "Update product information" : "Product details"}</h3><p>{product ? "Update the catalog details for this item." : "Add a product to your catalog. Add stock from Stock control."}</p></div></div>
    <form onSubmit={submit}>
      <div className="row g-3">
        <div className="col-md-6"><label className="form-label">Product name <span>*</span></label><input className="form-control" name="name" value={form.name} onChange={change} maxLength="160" required placeholder="e.g. Wireless Keyboard" /></div>
        <div className="col-md-6"><label className="form-label">Product code <span>*</span></label><input className="form-control" name="code" value={form.code} onChange={change} maxLength="80" required placeholder="e.g. KEY-001" /></div>
        <div className="col-12"><label className="form-label">Description</label><textarea className="form-control" name="description" value={form.description} onChange={change} rows="3" maxLength="1000" placeholder="Product details (optional)" /></div>
        <div className="col-md-6"><label className="form-label">Unit price <span>*</span></label><div className="input-group"><span className="input-group-text">$</span><input className="form-control" name="price" type="number" min="0" step="0.01" value={form.price} onChange={change} required placeholder="0.00" /></div></div>
      </div>
      <div className="form-actions"><button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : product ? "Save changes" : "Create product"}</button></div>
    </form>
  </section>;
}

function StockPage({ products, onSubmit }) {
  const [form, setForm] = useState({ productId: "", quantity: "", description: "", type: "IN" });
  const [saving, setSaving] = useState(false);
  const selectedProduct = products.find((product) => String(product.id) === form.productId);
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const ok = await onSubmit({ productId: Number(form.productId), quantity: Number(form.quantity), description: form.description }, form.type);
    if (ok) setForm((current) => ({ ...current, quantity: "", description: "" }));
    setSaving(false);
  };
  return <div className="row g-4">
    <div className="col-12 col-lg-7"><section className="panel-card form-card">
      <div className="section-heading"><div><h3>Record a stock movement</h3><p>Every adjustment is saved to the permanent movement history.</p></div></div>
      <form onSubmit={submit}>
        <label className="form-label">Movement type</label>
        <div className="movement-toggle mb-4">
          <button type="button" className={form.type === "IN" ? "selected in" : ""} onClick={() => setForm({ ...form, type: "IN" })}><i className="bi bi-box-arrow-in-down me-2" />Stock in</button>
          <button type="button" className={form.type === "OUT" ? "selected out" : ""} onClick={() => setForm({ ...form, type: "OUT" })}><i className="bi bi-box-arrow-up me-2" />Stock out</button>
        </div>
        <div className="mb-3"><label className="form-label">Product <span>*</span></label><select className="form-select" value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required><option value="">Select a product…</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.code} ({product.quantity} in stock)</option>)}</select></div>
        {selectedProduct && <div className="available-stock"><span>Current stock</span><strong>{selectedProduct.quantity.toLocaleString()} units</strong></div>}
        <div className="mb-3"><label className="form-label">Quantity <span>*</span></label><input className="form-control" type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required placeholder="Enter quantity" /></div>
        <div className="mb-4"><label className="form-label">Description</label><input className="form-control" value={form.description} maxLength="500" onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="e.g. Purchase order #1048" /></div>
        <button className="btn btn-primary w-100" disabled={saving || !products.length}>{saving ? "Recording…" : "Record movement"}</button>
      </form>
    </section></div>
    <div className="col-12 col-lg-5"><section className="info-card">
      <div className="info-icon"><i className="bi bi-shield-check" /></div><h3>Accurate stock records</h3>
      <p>Stock updates are processed atomically. Stock removal is rejected when there are not enough units available, so inventory can never fall below zero.</p>
      <div className="info-rule" /><div className="info-detail"><i className="bi bi-check-circle-fill" /> Every adjustment is recorded</div><div className="info-detail"><i className="bi bi-check-circle-fill" /> Product quantity updates immediately</div><div className="info-detail"><i className="bi bi-check-circle-fill" /> Full audit history is retained</div>
    </section></div>
  </div>;
}

function MovementPage({ movements }) {
  return <section className="panel-card">
    <div className="section-heading"><div><h3>Stock movement history</h3><p>A complete audit trail of stock additions and removals.</p></div><span className="count-pill">{movements.length} records</span></div>
    {movements.length ? <MovementTable movements={movements} /> : <EmptyState title="No movement history yet" message="Stock additions and removals will appear here." />}
  </section>;
}

function MovementTable({ movements }) {
  if (!movements?.length) return <EmptyState title="No activity yet" message="Stock movements will appear here once recorded." />;
  return <div className="table-responsive"><table className="table align-middle data-table movement-table">
    <thead><tr><th>PRODUCT</th><th>TYPE</th><th>QUANTITY</th><th>DESCRIPTION</th><th>DATE</th></tr></thead>
    <tbody>{movements.map((item) => <tr key={item.id}>
      <td><div className="movement-product"><strong>{item.productName}</strong><small>{item.productCode}</small></div></td>
      <td><span className={`movement-type ${item.type === "IN" ? "type-in" : "type-out"}`}><i className={`bi ${item.type === "IN" ? "bi-arrow-down-left" : "bi-arrow-up-right"}`} />{item.type === "IN" ? "Stock in" : "Stock out"}</span></td>
      <td className="quantity-cell">{item.type === "IN" ? "+" : "−"}{item.quantity}</td><td className="muted-cell">{item.description || "—"}</td><td className="muted-cell">{dateTime(item.createdAt)}</td>
    </tr>)}</tbody>
  </table></div>;
}

function StockBadge({ product }) {
  if (product.quantity === 0) return <span className="stock-badge out">Out of stock</span>;
  if (product.lowStock) return <span className="stock-badge low">Low stock</span>;
  return <span className="stock-badge healthy">In stock</span>;
}

function EmptyState({ title, message }) {
  return <div className="empty-state"><div><i className="bi bi-inboxes" /></div><strong>{title}</strong><p>{message}</p></div>;
}

export default App;
