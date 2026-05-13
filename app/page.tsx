export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          
          <div>
            <span className="bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-medium">
              Distribuição Pet B2B
            </span>

            <h1 className="text-5xl font-bold mt-6 leading-tight">
              Compra fácil para pet shops de todo Brasil
            </h1>

            <p className="text-gray-600 text-lg mt-6">
              AQUI VOCÊ ENCONTRA Estoque amplo, entrega rápida e produtos das melhores marcas.
            </p>

            <button className="mt-8 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-2xl font-semibold transition">
              Comprar no Atacado
            </button>
          </div>

          <div>
            <img
              src="https://images.unsplash.com/photo-1517849845537-4d257902454a"
              alt="Pet"
              className="rounded-3xl shadow-xl"
            />
          </div>

        </div>
      </section>
    </main>
  )
}