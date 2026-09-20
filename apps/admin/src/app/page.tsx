export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Panel principal</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Hoteles
          </h2>
          <p className="text-3xl font-bold mt-2">
            <a
              href="/hotels"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Administrar
            </a>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Recepción
          </h2>
          <p className="text-3xl font-bold mt-2">
            <a
              href="/recepcion"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Check-in / out
            </a>
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Tipos de habitación
          </h2>
          <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">
            Se gestionan desde el detalle de cada hotel
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Inventario
          </h2>
          <p className="text-sm text-gray-500 mt-2 dark:text-gray-400">
            Se gestiona desde el detalle de cada hotel
          </p>
        </div>
      </div>
    </div>
  );
}
