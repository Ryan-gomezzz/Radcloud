export function AssetMapTab({ inventory }) {
  if (!inventory?.length) {
    return <p className="text-slate-500">No inventory yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Name</th>
            <th className="py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-slate-800">{row.type}</td>
              <td className="py-2 pr-4">{row.name}</td>
              <td className="py-2 text-slate-600">
                {Object.entries(row)
                  .filter(([k]) => !["type", "name"].includes(k))
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
