import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      {/* Decorative gradient orb */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "500px",
          height: "500px",
          background:
            "radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, transparent 70%)",
          borderRadius: "50%",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div className="animate-fadeIn" style={{ position: "relative", zIndex: 1 }}>
        {/* Logo / Brand */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-3)",
            marginBottom: "var(--space-8)",
            padding: "var(--space-2) var(--space-5)",
            background: "var(--bg-glass)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-full)",
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
          }}
        >
          <span style={{ fontSize: "1.25rem" }}>🧠</span>
          <span>
            Powered by <strong style={{ color: "var(--primary-400)" }}>Gemini AI</strong>
          </span>
        </div>

        <h1
          style={{
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            marginBottom: "var(--space-6)",
            background:
              "linear-gradient(135deg, var(--text-primary) 0%, var(--primary-300) 50%, var(--accent-400) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          AI Assessment
          <br />
          Creator
        </h1>

        <p
          style={{
            fontSize: "1.125rem",
            color: "var(--text-secondary)",
            maxWidth: "560px",
            margin: "0 auto var(--space-10)",
            lineHeight: 1.7,
          }}
        >
          Create structured, professionally formatted question papers in seconds.
          Just define your requirements and let AI handle the rest.
        </p>

        <Link href="/create">
          <button
            className="btn btn-primary btn-lg"
            id="create-assignment-cta"
            style={{
              fontSize: "1.0625rem",
              padding: "var(--space-4) var(--space-10)",
              borderRadius: "var(--radius-full)",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>✨</span>
            Create Assessment
          </button>
        </Link>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "var(--space-3)",
            marginTop: "var(--space-12)",
          }}
        >
          {[
            "📝 Multiple Question Types",
            "🎯 Difficulty Balancing",
            "📄 PDF Export",
            "⚡ Real-time Generation",
          ].map((feature) => (
            <span
              key={feature}
              style={{
                padding: "var(--space-2) var(--space-4)",
                background: "var(--bg-glass)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-full)",
                fontSize: "0.8125rem",
                color: "var(--text-muted)",
              }}
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </main>
  );
}
