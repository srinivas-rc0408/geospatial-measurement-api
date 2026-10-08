import { useParams } from 'react-router'

export default function Results() {
  const { id } = useParams()
  return (
    <section className="mx-auto flex max-w-workspace flex-col gap-2 px-5.5 py-16 sm:px-10">
      <title>Results · Geo Measure</title>
      <h1 className="text-title-2">Results</h1>
      <p className="font-mono text-caption text-text-secondary">File {id}</p>
    </section>
  )
}
