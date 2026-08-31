import Image from "next/image";
import type { NewsItem } from "@/lib/dashboard-data";
import { SectionHeader } from "./primitives";

/**
 * Berita tampil sebagai baris kartu yang digeser horizontal — sesuai desain,
 * dan sekaligus jadi perilaku yang benar di layar HP.
 */
export function NewsSection({ items }: { items: NewsItem[] }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader title="Berita" actionLabel="Lihat Semua" tone="title" />

      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex w-[296px] shrink-0 snap-start flex-col overflow-hidden rounded-[14px] border border-pfi-news-line bg-white"
          >
            <div className="relative h-40 w-full">
              <Image
                src={item.image}
                alt=""
                fill
                sizes="296px"
                className="object-cover"
              />
            </div>

            <div className="flex flex-1 flex-col gap-4 p-4">
              <h3 className="line-clamp-2 text-base text-pfi-title">{item.title}</h3>
              <p className="mt-auto text-xs text-pfi-news-meta">{item.date}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
