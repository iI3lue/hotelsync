export default async function InventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Gestión de inventario</h1>
      <p className="text-gray-600 mb-4 dark:text-gray-300">
        Gestioná la disponibilidad y los bloqueos de las habitaciones del hotel{" "}
        <code className="bg-gray-100 px-2 py-1 rounded dark:bg-gray-700">
          {id}
        </code>
      </p>

      <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">
          Formulario de inventario — elegí un tipo de habitación y una fecha
          para definir la disponibilidad o bloquear/desbloquear habitaciones por
          mantenimiento.
        </p>
      </div>
    </div>
  );
}
