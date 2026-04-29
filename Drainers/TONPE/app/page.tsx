export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#f5f5f5",
        color: "#1e3932",
      }}
    >
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <h1 style={{ fontSize: "2rem", color: "#00704A", margin: 0 }}>
          Starbucks Coffee
        </h1>
        <p style={{ color: "#6b6b6b", marginTop: "0.5rem" }}>
          Freshly brewed coffee, espresso & more.
        </p>
      </div>
    </main>
  );
}
