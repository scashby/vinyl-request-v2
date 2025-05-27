export default function ImportDiscogs() {
  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Discogs CSV Import</h2>
      <p className="mb-4 text-gray-600">Upload your Discogs export CSV to refresh album metadata.</p>
      <input type="file" accept=".csv" className="border p-2 rounded" />
      <p className="mt-2 text-sm text-gray-500">(Parsing functionality to be added next chunk.)</p>
    </div>
  )
}