import { notFound } from "next/navigation";
import { SECTIONS, type SectionSlug } from "@/lib/sections";
import Library from "@/components/Library";

type Props = {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ item?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { section } = await params;
  if (!(section in SECTIONS)) return {};
  return { title: SECTIONS[section as SectionSlug].label };
}

export default async function SectionPage({ params, searchParams }: Props) {
  const { section } = await params;
  if (!(section in SECTIONS)) notFound();
  const { item } = await searchParams;
  return <Library section={section as SectionSlug} initialItemId={item} />;
}
