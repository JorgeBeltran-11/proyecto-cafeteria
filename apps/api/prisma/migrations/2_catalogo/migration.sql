-- Spec 003: tablas del módulo catalogo.

-- CreateTable
CREATE TABLE "Producto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precioCentavos" INTEGER NOT NULL,
    "imagenUrl" TEXT,
    "imagenAlt" TEXT,
    "alergenos" TEXT,
    "agotado" BOOLEAN NOT NULL DEFAULT false,
    "existencias" INTEGER,
    "retirado" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estado" TEXT NOT NULL,
    "borrador" TEXT NOT NULL,
    "versionPublicada" INTEGER,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "creadoEn" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VersionMenu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "menuId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "cambios" TEXT NOT NULL,
    "publicadaPor" TEXT NOT NULL,
    "publicadaEn" DATETIME NOT NULL,
    "restauradaDe" INTEGER,
    CONSTRAINT "VersionMenu_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CambioCatalogo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "VersionMenu_menuId_numero_key" ON "VersionMenu"("menuId", "numero");

-- CreateIndex
CREATE INDEX "CambioCatalogo_entidad_entidadId_idx" ON "CambioCatalogo"("entidad", "entidadId");
