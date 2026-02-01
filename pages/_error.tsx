import { NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0D0D12",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "4rem", fontWeight: "bold", marginBottom: "1rem", opacity: 0.5 }}>
          {statusCode || "Error"}
        </h1>
        <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
          {statusCode === 404
            ? "This page could not be found."
            : "An error occurred."}
        </p>
        <a
          href="/"
          style={{
            color: "#FF6B2C",
            textDecoration: "none",
          }}
        >
          Go back home
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
