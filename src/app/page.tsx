export const dynamic = 'force-static';

export default function RootPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="text-3xl font-semibold">ZIP Encoding Fixer</h1>
        <p className="mt-4 text-base text-slate-600">
          기본 언어 페이지로 이동하세요.
        </p>
        <a
          className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
          href="/ko/"
        >
          한국어로 이동
        </a>
      </div>
    </main>
  );
}
