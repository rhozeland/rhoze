import { useSearchParams } from "react-router-dom";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Rhozeland</div>
        {sessionId ? (
          <>
            <h1 className="text-2xl font-semibold">Payment received — thank you.</h1>
            <p className="text-sm text-muted-foreground">We've received your payment and will email you within one business day with next steps and your project code (if applicable). Check your inbox at the address you entered.</p>
            <p className="text-xs text-muted-foreground">Reference: <code className="font-mono">{sessionId.slice(0, 18)}…</code></p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Checkout cancelled</h1>
            <p className="text-sm text-muted-foreground">No charge was made. <a href="/start.html" className="underline">Start over</a>.</p>
          </>
        )}
        <a href="/" className="inline-block text-sm underline mt-4">Return home</a>
      </div>
    </div>
  );
}