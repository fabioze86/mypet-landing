import { Suspense } from "react";
import { LeadGateProvider } from "@mypet/core/components/lead-gate";
import { SiteNav } from "@mypet/core/components/site-nav";
import { CompleteSignupForm } from "@mypet/core/components/complete-signup-form";
import { getCategories } from "@mypet/core/catalog";
import { clientConfig } from "@/client.config";
import { completeSignup } from "./actions";

const { palette: PALETTE } = clientConfig;

async function CompleteSignupFormSection({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next ?? "/cotacao";

  return <CompleteSignupForm action={completeSignup.bind(null, target)} />;
}

export default async function CompletarCadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const categories = await getCategories();

  return (
    <div style={{ fontFamily: "'Nunito', 'Nunito Sans', sans-serif", background: PALETTE.gray50, minHeight: "100vh", color: PALETTE.gray800 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid ${PALETTE.gray200};
          border-radius: 10px;
          font-family: 'Nunito Sans', sans-serif;
          font-size: 15px;
          color: ${PALETTE.gray800};
          outline: none;
          margin-bottom: 12px;
        }
        .form-input:focus { border-color: ${PALETTE.pink}; }
        .form-submit {
          width: 100%;
          padding: 14px;
          background: ${PALETTE.pink};
          color: white;
          border: none;
          border-radius: 10px;
          font-family: 'Nunito', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .form-submit:hover { background: ${PALETTE.pinkDark}; }
        .form-submit:disabled { opacity: 0.6; cursor: default; }
      `}</style>

      <LeadGateProvider>
        <SiteNav categories={categories} />
        <main style={{ maxWidth: 440, margin: "0 auto", padding: "60px 24px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: PALETTE.navy, marginBottom: 8, textAlign: "center" }}>
            Complete seu cadastro
          </h1>
          <p style={{ fontSize: 14, color: PALETTE.gray600, textAlign: "center", marginBottom: 24 }}>
            É seu primeiro acesso — precisamos de mais alguns dados.
          </p>
          <Suspense fallback={null}>
            <CompleteSignupFormSection searchParams={searchParams} />
          </Suspense>
        </main>
      </LeadGateProvider>
    </div>
  );
}
