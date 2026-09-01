# 👶 Portal de Asistencia y Seguridad Infantil (Edición Pastel Amarillo & Blanco)

Sistema web interactivo y seguro para el control de asistencia de niños de cada domingo, protegido con un **Portal de Ingreso (Login)** validado en el servidor de **Google Apps Script**, con mensajería instantánea por **WhatsApp** a los padres y diseño en tonos **blanco y amarillo pastel cálido**.

---

## 🎨 Nuevo Diseño Visual
- **Colores Principales**: Blanco puro (`#FFFFFF`) y tonos amarillo pastel / manteca suave (`#FFFDF5`, `#FEF9C3`, `#FEF08A`, `#FACC15`, `#CA8A04`).
- **Aspecto Amigable**: Botones redondeados, tarjetas suaves con sombras sutiles y alto contraste para facilitar la lectura en tablets y celulares bajo la luz del día.

---

## 🔐 Seguridad y Portal de Ingreso

El sistema cuenta con un **Portal de Login general** antes de dar acceso a los registros de los niños:

### Credenciales de Acceso (Guardadas de forma segura en `Code.gs`):
- **Usuario**: `igrkids2026`
- **Contraseña**: `IgrKids*2026!Seguro`

> 🛡️ **¿Cómo cambiar el usuario o contraseña?**  
> Las credenciales NO están expuestas en el código HTML/JS de la web. Se validan directamente en el servidor de Google Apps Script (`Code.gs`) dentro del objeto `AUTH_CONFIG`:
> ```javascript
> const AUTH_CONFIG = {
>   usuarioMaster: "igrkids2026",          // Tu usuario general
>   passwordMaster: "IgrKids*2026!Seguro", // Tu contraseña segura
>   nombreUsuario: "Equipo IgrKids",
>   ...
> };
> ```
> Para cambiar la contraseña, simplemente edita esa línea en tu Apps Script y vuelve a implementar la aplicación web.

---

## 🚀 Funcionalidades Principales

1. **🔐 Portal de Ingreso Protegido**:
   - Bloqueo total de la página hasta que se ingrese usuario y contraseña válidos.
   - Botón para ver/ocultar contraseña.
   - Sesión activa persistente en el dispositivo para no tener que iniciar sesión en cada recarga.
   - Botón de **Cerrar Sesión** en la barra superior.

2. **📋 Toma de Asistencia Rápida**:
   - Búsqueda en tiempo real por nombre del niño, nombre de los padres o teléfono de contacto.
   - Marcado de ingreso con 1 solo clic y registro automático de hora exacta.
   - Filtros por salas: *Sala Cunas (0-2 años)*, *Párvulos (3-5 años)*, *Primarios (6-8 años)*, *Pre-Adolescentes (9-12 años)*.

3. **💬 Avisos Inmediatos a los Padres (WhatsApp)**:
   - Botón directo para contactar a los padres con plantillas de 1 solo clic:
     - 📍 *Acercarse a la sala de niños*
     - 🚼 *Cambio de pañal / ropa*
     - 😢 *El nene está triste / extraña a sus papás*
     - 🚪 *Fin de la clase (retiro de niños)*
     - ✍️ *Mensaje personalizado libre*

4. **📊 Descarga de Reportes & Exportaciones**:
   - **Excel (.xlsx)**: Descarga automática de la lista completa del día.
   - **PDF Imprimible**: Roster formal listo para imprimir en secretaría.
   - **Resumen para WhatsApp**: Formateado con totales y desglose por sala listo para enviar al grupo de líderes.

5. **➕ Registro Rápido de Nuevos Niños**:
   - Formulario para inscribir a un niño nuevo en la base de datos de Google Sheets directamente desde la web.

6. **🛡️ Resiliencia Offline**:
   - Almacenamiento local en `localStorage`. Si la señal Wi-Fi cae, la asistencia se guarda en el dispositivo y se sincroniza.

---

## ⚙️ Conexión con Google Sheets (Paso a Paso)

### 1. Base de Datos en Google Sheets
- **URL Hoja de Cálculo**: [Abrir Google Sheets](https://docs.google.com/spreadsheets/d/19XrXo04KUeNyiYnizL_ehYV_ODnnFlv3br6AlRBXjLg/edit)
- **Hoja de Niños**: `Registro de NIÑOS`
- **Hoja de Asistencias**: `Asistencias` (Se crea automáticamente al registrar el primer ingreso).

### 2. Configurar el Google Apps Script
1. En tu Google Sheets, abre el menú superior: **Extensiones** ➔ **Apps Script**.
2. Abre o crea un nuevo archivo de script (por ejemplo `AsistenciaBackend.gs`).
3. Copia y pega el código que está en `google-apps-script/Code.gs`.
4. Haz clic en el botón azul superior **Implementar (Deploy)** ➔ **Nueva implementación (New deployment)**.
5. Selecciona el tipo: **Aplicación web (Web App)**.
6. Configura los parámetros:
   - **Descripción**: `API Asistencia Niños`
   - **Ejecutar como**: `Yo (tu correo de Google)`
   - **Quién tiene acceso**: `Cualquier persona (Anyone)` *(Indispensable para que la web pueda conectarse)*.
7. Haz clic en **Implementar**, otorga los permisos necesarios y **copia la URL de la Web App** que te entrega Google (termina en `/exec`).

### 3. Activar en la Página Web
1. Abre `index.html` en tu navegador.
2. Inicia sesión con el usuario `admin` y la contraseña `asistencianinos`.
3. Haz clic en el ícono de **⚙️ Configuración** (arriba a la derecha o en el login).
4. Pega la URL de tu Google Apps Script.
5. Haz clic en **"Probar Conexión"** y luego en **"Guardar Cambios"**.
6. ¡Listo! El indicador cambiará a **Google Sheets Online** y sincronizará en vivo con la hoja de cálculo.

---

## 📁 Estructura del Proyecto

```
Pagina asistencia niños/
│
├── index.html                   # Portal de Login + Interfaz de Asistencia (Blanco & Amarillo Pastel)
├── styles.css                   # Estilos personalizados en paleta pastel manteca y vistas de impresión
├── app.js                       # Lógica de autenticación segura, búsqueda, WhatsApp y reportes
├── vercel.json                  # Configuración para despliegue en Vercel
├── README.md                    # Documentación y guía de instalación
└── google-apps-script/
    └── Code.gs                  # Backend en Apps Script con validación de credenciales en servidor
```

---

Desarrollado para **Code Ahumada** © 2026.
