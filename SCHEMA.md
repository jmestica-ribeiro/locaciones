# Esquema de base de datos — PD Obras

> Base de datos PostgreSQL alojada en Supabase. Todas las tablas tienen RLS (Row Level Security) habilitado.
> Documento generado el 2026-06-14 para facilitar la migración a otro sistema.

---

## Diagrama de relaciones

```
Proyectos (ID_Proyecto)
  ├── Etapas          (ID_Proyecto → Proyectos)
  │     └── InsumosPlanificados  (ID_Etapa → Etapas.ID)
  ├── Avance          (ID_Proyecto, nombre_etapa)
  │     └── Recursos  (ID_Avance → Avance.id)
  ├── CurvasPlan      (ID_Proyecto → Proyectos)
  │     ├── PuntosCurva      (ID_Curva → CurvasPlan.id)        — modo "porcentaje"
  │     └── PuntosCurvaItem  (ID_Curva → CurvasPlan.id,
  │                           ID_Etapa → Etapas.ID)            — modo "item"
  └── FotosPartes     (ID_Proyecto → Proyectos)

Maestros independientes:
  ├── ListadoPersonal
  ├── ListadoVehiculos
  ├── Fases
  └── profiles        (id → auth.users.id)
```

---

## Tablas

### `Proyectos`
Tabla raíz del sistema. Cada registro es una obra o proyecto de construcción.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `ID_Proyecto` | text | NO (PK) | Identificador único del proyecto (ej: `"ROT-AV-PERON"`) |
| `Cliente` | text | NO | Nombre del cliente o comitente |
| `Ubicación` | text | SÍ | Localización geográfica de la obra |
| `Descripción` | text | SÍ | Descripción libre del proyecto |
| `Estado` | text | SÍ | Estado actual: `"En curso"`, `"Finalizado"`, `"Pausado"`, etc. |
| `Tipo_Proyecto` | text | SÍ | Categoría del proyecto |
| `CECO` | text | SÍ | Centro de costos asociado |

**Notas:** `ID_Proyecto` es un texto libre definido por el usuario al crear el proyecto (no autoincremental). Es la clave de referencia usada por la mayoría del resto de las tablas.

---

### `Etapas`
Etapas o ítems contractuales de un proyecto. Cada proyecto tiene múltiples etapas, y el progreso total se calcula ponderando por `incidencia`.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `ID` | uuid | NO (PK) | Identificador único (autogenerado) |
| `ID_Proyecto` | text | NO (FK) | Referencia a `Proyectos.ID_Proyecto` |
| `nombre_etapa` | text | SÍ | Nombre descriptivo de la etapa |
| `fase` | text | SÍ | Tag de agrupación (ej: `"CONSTRUCCIÓN"`, `"SEÑALIZACIÓN"`) |
| `UM` | text | SÍ | Unidad de medida (`m`, `m²`, `m³`, `ml`, `tn`, `u`, etc.) |
| `total` | numeric | SÍ | Cantidad total planificada en la unidad `UM` |
| `incidencia` | numeric | SÍ | Peso porcentual de la etapa sobre el avance total del proyecto (0–100, deben sumar 100) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

**Notas:** El progreso ejecutado de cada etapa se calcula sumando `Avance.total_avance` donde `Avance.nombre_etapa = Etapas.nombre_etapa`. No hay FK directa entre `Avance` y `Etapas` — la relación es por nombre de etapa.

---

### `Avance`
Registros diarios de avance de obra (también llamados "partes diarios"). Cada fila representa un reporte de trabajo de un día.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Proyecto` | text | SÍ | Referencia a `Proyectos.ID_Proyecto` |
| `ID_Parte` | uuid | SÍ | Agrupador lógico: todos los avances de un mismo parte diario comparten este ID |
| `fecha_avance` | date | SÍ | Fecha del parte |
| `nombre_etapa` | text | SÍ | Nombre de la etapa a la que corresponde este avance |
| `fase` | text | SÍ | Fase/tag (copiado de la etapa al momento del registro) |
| `total_avance` | numeric | SÍ | Cantidad ejecutada en esta entrada |
| `UM` | text | SÍ | Unidad de medida del avance |
| `descripcion` | text | SÍ | Descripción de los trabajos realizados |
| `observaciones_parte` | text | SÍ | Observaciones generales del parte |
| `estado_revision` | text | SÍ | Estado de revisión: `"SIN REVISAR"` (default), `"REVISADO"`, `"APROBADO"`, `"RECHAZADO"` |
| `motivo_npt` | text | SÍ | Motivo de tiempo no productivo (NPT), si aplica |
| `tiempo_npt` | bigint | SÍ | Horas de NPT |
| `detalle_npt` | text | SÍ | Descripción detallada del NPT |
| `created_at` | timestamptz | SÍ | Fecha de creación del registro |

**Notas:** Un "parte diario" puede tener múltiples etapas. Todos los registros de un mismo parte comparten el mismo `ID_Parte`. Los recursos utilizados (personal y vehículos) se registran en la tabla `Recursos` referenciando `id` de esta tabla.

---

### `Recursos`
Personal y vehículos utilizados en cada registro de avance. Cada fila es un recurso (una persona o un vehículo) asignado a un parte.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Avance` | uuid | SÍ (FK) | Referencia a `Avance.id` |
| `ID_Etapa` | text | SÍ | Nombre de la etapa a la que se asignó el recurso |
| `tipo_recurso` | text | SÍ | Tipo: `"personal"` o `"vehiculo"` |
| `detalle_recurso` | text | SÍ | Nombre del recurso (ej: nombre y apellido, o código interno del vehículo) |
| `categoria` | text | SÍ | Categoría libre |
| `puesto` | text | SÍ | Puesto del personal (copiado de `ListadoPersonal`) |
| `familia` | text | SÍ | Familia del vehículo: `"Flota Pesada"`, `"Flota Liviana"`, `"Maquinaria"` |
| `subfamilia` | text | SÍ | Subfamilia del vehículo (ej: `"Camioneta"`, `"Retroexcavadora"`) |
| `total_hs` | numeric | SÍ | Horas trabajadas por el recurso en ese parte |
| `observaciones` | text | SÍ | Notas adicionales |
| `ID_RecursoFuente` | uuid | SÍ | UUID del recurso origen en `ListadoPersonal` o `ListadoVehiculos` (referencia lógica, sin FK formal) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

---

### `InsumosPlanificados`
Materiales e insumos planificados por etapa para gestión de compras. Permite estimar costos de adquisición.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Etapa` | text | NO | UUID de la etapa a la que pertenece (referencia a `Etapas.ID`) |
| `nombre` | text | NO | Nombre del material o insumo (ej: `"Hormigón H30"`, `"Asfalto"`) |
| `unidad` | text | SÍ | Unidad de medida (`m³`, `tn`, `kg`, `u`, etc.) |
| `cantidad` | numeric | SÍ | Cantidad planificada a adquirir |
| `costo_unitario` | numeric | SÍ | Precio por unidad (en moneda local) |
| `observaciones` | text | SÍ | Especificaciones, proveedor sugerido, notas |
| `created_at` | timestamptz | SÍ | Fecha de creación |

**Notas:** El costo total estimado de un insumo se calcula como `cantidad × costo_unitario`. `ID_Etapa` almacena el UUID como texto (sin FK formal a `Etapas.ID`).

---

### `ListadoPersonal`
Catálogo maestro de personal de la empresa. Se usa para seleccionar recursos al cargar un parte.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `nombre` | text | SÍ | Nombre del empleado |
| `apellido` | text | SÍ | Apellido del empleado |
| `puesto` | text | SÍ | Cargo o función (ej: `"Operario"`, `"Capataz"`) |
| `legajo` | text | SÍ | Número de legajo interno |
| `centro_costo` | text | SÍ | Centro de costo al que pertenece |
| `created_at` | timestamptz | SÍ | Fecha de creación |

---

### `ListadoVehiculos`
Catálogo maestro de la flota de vehículos y maquinaria. Se usa para seleccionar recursos al cargar un parte.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `interno` | text | SÍ | Código interno del vehículo (ej: `"V-012"`) |
| `dominio` | text | SÍ | Patente/matrícula |
| `familia` | text | SÍ | Categoría: `"Flota Pesada"`, `"Flota Liviana"`, `"Maquinaria"` |
| `subfamilia` | text | SÍ | Subcategoría (ej: `"Camión volcador"`, `"Retroexcavadora"`) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

---

### `Fases`
Catálogo de fases o tags usados para agrupar etapas dentro de un proyecto.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `nombre` | text | NO (único) | Nombre de la fase en mayúsculas (ej: `"CONSTRUCCIÓN"`, `"SEÑALIZACIÓN"`) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

---

### `CurvasPlan`
Curvas de avance planificado (curva S) asociadas a un proyecto. Un proyecto puede tener múltiples curvas.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Proyecto` | text | NO (FK) | Referencia a `Proyectos.ID_Proyecto` |
| `nombre` | text | NO | Nombre de la curva (ej: `"Línea base"`, `"Revisión 1"`) |
| `modo` | text | NO | `"porcentaje"` (default): puntos de % global en `PuntosCurva`. `"item"`: cantidades acumuladas por ítem en `PuntosCurvaItem` |
| `created_at` | timestamptz | SÍ | Fecha de creación |

---

### `PuntosCurva`
Puntos que definen la curva de avance planificado. Cada punto es una fecha con su porcentaje acumulado.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Curva` | uuid | NO (FK) | Referencia a `CurvasPlan.id` |
| `fecha` | date | NO | Fecha del punto |
| `avance` | numeric | NO | Porcentaje de avance planificado (0–100) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

**Restricción:** `avance` debe estar entre 0 y 100.

---

### `PuntosCurvaItem`
Planificación por ítem de las curvas en modo `"item"`. Cada fila es la cantidad **acumulada** planificada de una etapa a una fecha.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Curva` | uuid | NO (FK) | Referencia a `CurvasPlan.id` (on delete cascade) |
| `ID_Etapa` | uuid | NO (FK) | Referencia a `Etapas.ID` (on delete cascade) |
| `fecha` | date | NO | Fecha del punto |
| `cantidad` | numeric | NO | Cantidad acumulada planificada a la fecha, en la `UM` de la etapa (≥ 0) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

**Restricción:** único por (`ID_Curva`, `ID_Etapa`, `fecha`).

**Cálculo:** el % de la curva a cada fecha es `Σ min(cantidad_acum / Etapas.total, 1) × Etapas.incidencia`, igual que el avance real. Entre dos puntos de un mismo ítem se interpola linealmente por días; antes del primer punto el ítem aporta 0 y después del último se mantiene. Ver `src/curvas.js`.

---

### `FotosPartes`
Fotos adjuntas a los partes diarios. Las imágenes se almacenan en Supabase Storage (bucket `partes-fotos`).

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK) | Identificador único |
| `ID_Parte` | uuid | SÍ | Referencia al parte (`Avance.ID_Parte`) |
| `ID_Proyecto` | text | SÍ (FK) | Referencia a `Proyectos.ID_Proyecto` |
| `url` | text | NO | URL pública del archivo en Supabase Storage |
| `nombre` | text | SÍ | Nombre original del archivo |
| `orden` | smallint | SÍ | Orden de visualización (default: 0) |
| `created_at` | timestamptz | SÍ | Fecha de creación |

**Notas:** La ruta en el bucket sigue el patrón `{ID_Proyecto}/{ID_Parte}/{timestamp}.{ext}`.

---

### `profiles`
Perfiles de usuario vinculados al sistema de autenticación de Supabase Auth.

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `id` | uuid | NO (PK, FK) | Referencia a `auth.users.id` |
| `nombre` | text | SÍ | Nombre visible del usuario |
| `rol` | text | NO | Rol del usuario: `"admin"` o `"operador"` |
| `created_at` | timestamptz | SÍ | Fecha de creación |

**Restricción:** `rol` solo acepta los valores `"admin"` u `"operador"`.

---

## Consideraciones para la migración

### Relaciones sin FK formal
Las siguientes relaciones existen a nivel de aplicación pero **no tienen foreign key en la base de datos**:

| Relación | Descripción |
|---|---|
| `Avance.nombre_etapa` → `Etapas.nombre_etapa` | El avance se asocia a la etapa por nombre de texto, no por UUID |
| `Recursos.ID_RecursoFuente` → `ListadoPersonal.id` / `ListadoVehiculos.id` | Referencia lógica sin FK |
| `InsumosPlanificados.ID_Etapa` → `Etapas.ID` | Almacenado como text, sin FK |
| `FotosPartes.ID_Parte` → `Avance.ID_Parte` | Sin FK formal |

### Orden de carga de datos en migración
Para respetar dependencias, cargar en este orden:

1. `profiles` (requiere que los usuarios existan en `auth.users`)
2. `Fases`
3. `ListadoPersonal`
4. `ListadoVehiculos`
5. `Proyectos`
6. `Etapas`
7. `CurvasPlan`
8. `PuntosCurva`, `PuntosCurvaItem`
9. `Avance`
10. `Recursos`
11. `FotosPartes`
12. `InsumosPlanificados`
