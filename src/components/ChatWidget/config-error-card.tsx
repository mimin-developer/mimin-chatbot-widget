import React from "react";

interface ConfigErrorCardProps {
  errors: string[];
}

export const ConfigErrorCard: React.FC<ConfigErrorCardProps> = ({ errors }) => {
  return (
    <div className="mimin:flex mimin:flex-1 mimin:flex-col mimin:items-center mimin:justify-center mimin:p-4 mimin:bg-white">
      <div className="mimin:w-full mimin:rounded-lg mimin:border mimin:border-red-300 mimin:bg-red-50 mimin:p-4 mimin:shadow-sm">
        <h3 className="mimin:text-sm mimin:font-bold mimin:text-red-700">
          Widget configuration error
        </h3>
        <ul className="mimin:mt-2 mimin:space-y-1 mimin:list-disc mimin:pl-4">
          {errors.map((error) => (
            <li key={error} className="mimin:text-xs mimin:text-red-600">
              {error}
            </li>
          ))}
        </ul>
        <p className="mimin:mt-3 mimin:text-[10px] mimin:text-red-500">
          Check the browser console for details.
        </p>
      </div>
    </div>
  );
};
