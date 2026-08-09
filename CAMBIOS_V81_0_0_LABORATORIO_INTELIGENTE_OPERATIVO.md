# LA MAGDALENA OS v81.0.0 — Laboratorio Inteligente Operativo

## Objetivo
Incorporar un flujo de laboratorio trazable sin modificar el Motor Hídrico protegido.

## Cambios
- Importación de .xlsx/.xls/.csv desde Laboratorio y Nutrición.
- Lectura automática de todas las hojas del libro.
- Detección de pH, MO, CE, CIC/CEC, N, P, K, S, Ca, Mg, Zn, B, Fe, Mn, Cu, Mo, Na, Cl y RAS.
- Archivo del Excel original en Storage.
- Huella SHA-256 del archivo y bloqueo de duplicados accidentales.
- Registro de nombre, tamaño, hojas, celdas de origen y fecha de importación.
- Todo resultado importado queda como "Pendiente de revisión" hasta su confirmación manual.
- Los análisis de laboratorio NO modifican el Motor Hídrico en esta versión.

## Motor Hídrico
Los archivos protegidos permanecen idénticos a v80.3.1/v75.1 estable.
