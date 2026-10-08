export default function Home() {
  return (
    <section className="mx-auto flex max-w-marketing flex-col items-center gap-5 px-5.5 py-16 text-center sm:px-10 sm:py-24 md:py-32">
      <title>Geo Measure · Measure every site. Precisely.</title>
      <p className="text-caption font-semibold text-text-secondary">Geospatial File Measurement API</p>
      <h1 className="text-display">Measure every site. Precisely.</h1>
      <p className="max-w-prose text-body text-text-secondary">
        Upload a Shapefile or KML. Get areas and lengths in metres — computed in the right projection for
        every feature, and cross-checked against the Earth&apos;s true shape.
      </p>
    </section>
  )
}
