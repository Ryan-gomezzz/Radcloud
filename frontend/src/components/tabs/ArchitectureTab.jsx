export function ArchitectureTab({ awsMapping, awsArchitecture }) {
  return (
    <div className="space-y-6">
      {awsArchitecture && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Architecture</h3>
          <p className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
            {awsArchitecture}
          </p>
        </div>
      )}
      {awsMapping?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Service mapping</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-4">GCP resource</th>
                  <th className="py-2 pr-4">AWS service</th>
                  <th className="py-2 pr-4">Suggested shape</th>
                  <th className="py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {awsMapping.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{row.gcp_resource}</td>
                    <td className="py-2 pr-4">{row.aws_service}</td>
                    <td className="py-2 pr-4">{row.suggested_shape}</td>
                    <td className="py-2 text-slate-600">{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {!awsMapping?.length && !awsArchitecture && (
        <p className="text-slate-500">No mapping output yet.</p>
      )}
    </div>
  );
}
