const SUPPORTED_LANGS = ['ko', 'en', 'zh', 'ja', 'hi', 'fr', 'pt-br', 'de'] as const;

export function generateStaticParams() {
  return SUPPORTED_LANGS.map((lang) => ({ lang }));
}

export default function LangLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
