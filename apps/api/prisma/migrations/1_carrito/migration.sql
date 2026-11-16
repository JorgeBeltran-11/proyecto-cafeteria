-- Spec 004: tablas del módulo carrito.

-- CreateTable
CREATE TABLE "Carrito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LineaCarrito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "carritoId" TEXT NOT NULL,
    "productoId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precioVistoCentavos" INTEGER NOT NULL,
    "anadidaEn" DATETIME NOT NULL,
    CONSTRAINT "LineaCarrito_carritoId_fkey" FOREIGN KEY ("carritoId") REFERENCES "Carrito" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Carrito_clienteId_key" ON "Carrito"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "LineaCarrito_carritoId_productoId_key" ON "LineaCarrito"("carritoId", "productoId");
