const skeletonWidths = [
  "w-10",
  "w-36",
  "w-24",
  "w-28 h-7",
  "w-28",
  "w-16",
];

export default function OrdersTableSkeleton() {
  return (
    <tbody className="divide-y divide-gray-100">
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <tr
          key={rowIndex}
          className="animate-pulse"
        >
          {skeletonWidths.map((size, colIndex) => (
            <td
              key={colIndex}
              className="px-4 py-4"
            >
              <div
                className={`rounded bg-gray-200 ${size}`}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}