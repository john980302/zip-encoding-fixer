export const dynamic = 'force-static';

export default function RootPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
        <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white/90 px-8 py-10 shadow-[0_12px_36px_rgba(15,23,42,0.12)] backdrop-blur">
          <h1 className="text-3xl font-semibold">ZIP Encoding Fixer</h1>
          <p className="mt-4 text-base text-slate-600">
            기본 언어 페이지로 이동하세요.
          </p>
          <a
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.25)] ring-1 ring-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[0_12px_26px_rgba(15,23,42,0.28)]"
            href="/ko/"
          >
            한국어로 이동
          </a>
        </div>
      </div>
    </main>
  );
}
