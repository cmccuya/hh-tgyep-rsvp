export default function imageLoader({ src }: { src: string }) {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}${src}`;
}
