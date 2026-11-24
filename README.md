# Archivo IT — despliegue con Portainer

Aplicación web privada de música dividida en dos secciones, **Xino** y **Niros**, para subir documentos, buscar dentro de TXT, Word (.docx), Excel (.xlsx/.xlsm) y PDF, y abrir una vista previa desde la biblioteca. PDF se muestra en el navegador; texto, Word y Excel se presentan como texto extraído. También permite eliminar archivos con confirmación y editar archivos de texto, CSV/TSV y planillas XLSX (edición básica de celdas). Word y PDF se descargan para editarlos con su aplicación correspondiente. Los archivos se almacenan en el volumen persistente `archivo_it_data`, separado del código.

## Contenido del paquete

- `server.js`, `public/`, `package.json`: aplicación.
- `Dockerfile`, `docker-compose.yml`: imagen y Stack de Portainer.
- El repositorio **no debe contener** tus archivos de datos. `.gitignore` excluye documentos sensibles y archivos de datos comunes.

## Despliegue recomendado

1. Descomprimí el ZIP y subí el contenido de la carpeta al repositorio **privado** de GitHub; no subas solo el ZIP. En la raíz del repositorio deben quedar `docker-compose.yml`, `Dockerfile`, `server.js`, `package.json` y la carpeta `public`. Revisá que no haya documentos reales, `.env` ni credenciales.
2. En Portainer, creá un Stack desde ese repositorio y elegí la misma rama donde están esos archivos. Si están directamente en la raíz, el Compose path es `docker-compose.yml`. Si subiste la carpeta contenedora completa, usá `Archivo IT Portainer corregido/docker-compose.yml` como ruta. Portainer clona el repositorio y resuelve el Compose path desde su raíz.
3. En el apartado **Environment variables** del Stack definí:
   - `APP_USER`: tu usuario.
   - `APP_PASSWORD`: una contraseña aleatoria larga (mínimo 14 caracteres).
   - `SESSION_SECRET`: cadena aleatoria de al menos 32 caracteres.
   - `TELEGRAM_BOT_TOKEN`: token del bot que entrega BotFather. Es opcional; cargalo solo como variable del Stack en Portainer, nunca en GitHub.
   - `TELEGRAM_ALLOWED_USERS`: IDs numéricos de Telegram autorizados, separados por coma. Es obligatorio para consultar datos desde el bot.
   - `DISCORD_BOT_TOKEN`: token del bot de Discord (Developer Portal > Bot). Es opcional; cargalo solo como variable del Stack, nunca en GitHub.
   - `DISCORD_ALLOWED_USERS`: IDs de usuario de Discord autorizados, separados por coma. Es obligatorio para consultar datos desde el bot.
   - `WHISPER_URL` y `WHISPER_TOKEN`: opcionales, para consultar por mensaje de voz (ver *Búsqueda por voz*).
   El Compose toma estos valores directamente del formulario del Stack. Si falta alguno, el contenedor mostrará un error de configuración en sus logs.
4. Desplegá el Stack. El volumen `archivo_it_data` se crea automáticamente y sobrevive a recreaciones del contenedor.
5. El puerto se publica como `${APP_PORT:-9090}` para acceder desde otras PCs de la red local usando `http://IP-DEL-SERVIDOR:9090`. El valor predeterminado `COOKIE_SECURE=0` permite iniciar sesión por HTTP durante pruebas en una red confiable. Para usar un proxy inverso con HTTPS, configurá `COOKIE_SECURE=1` y reenviá al puerto del servidor. No expongas el puerto directamente a Internet; para acceso remoto usá HTTPS y VPN.
6. En la web, iniciá sesión y cargá archivos o una carpeta completa. La biblioteca aparece primero y el índice de búsqueda se completa en segundo plano. Al subir una carpeta, la aplicación sugiere categorías usando nombres y subcarpetas; también podés elegir una categoría manualmente. Cada archivo puede pesar hasta 100 MB.

## Relevamiento de equipos (Liquid)

El sitio incluye el **Relevamiento de equipos** (versión Liquid Glass) en `http://IP-DEL-SERVIDOR:9090/relevamiento/`, protegido por **la misma pantalla de inicio de sesión** y el mismo usuario y contraseña (`APP_USER` / `APP_PASSWORD`). Desde la biblioteca de música se entra con el botón **🖥 Relevamiento** de la barra superior, y desde el relevamiento se vuelve con **♪ Música**. **Salir** cierra la sesión de los dos.

- El código está en la carpeta `relevamiento/` y corre como un contenedor aparte (`archivo-relevamiento`) dentro del mismo Stack. No publica ningún puerto: solo se llega a él a través del sitio y con sesión iniciada.
- Los datos se guardan en el volumen `relevamiento_data` (SQLite). La primera vez se cargan los datos iniciales de `seed.json`.
- **Para conservar los datos de un despliegue anterior del relevamiento**, definí en el Stack `RELEVAMIENTO_VOLUME` con el nombre del volumen existente (en Portainer > Volumes, por ejemplo `relevamientos_relevamiento_data`). Detené antes el Stack viejo del relevamiento para que no usen la misma base al mismo tiempo. Otra opción: dejarlo vacío y usar **Importar Excel** con la planilla actualizada.
- Bot de Telegram del relevamiento (opcional): cargá `RELEVAMIENTO_TELEGRAM_BOT_TOKEN` (un bot distinto del de la biblioteca) y `RELEVAMIENTO_ALLOWED_CHAT_IDS` con los IDs autorizados. Si no definís IDs, cualquiera que encuentre el bot puede consultarlo. Sin token, el contenedor `archivo-relevamiento-bot` queda en espera y no hace nada.
- Después de subir estos cambios al repositorio, en Portainer usá **Update the stack** con **Re-pull image and redeploy** para que se construya la imagen nueva del relevamiento.

## Secciones de música: Xino y Niros

La biblioteca se divide en dos secciones: **Xino** y **Niros**. Al tocar **＋ Agregar** hay que elegir una de las dos antes de subir (si ya estás dentro de una sección, queda elegida). Se aceptan TXT, MD, CSV, TSV, LOG, Word (DOC/DOCX), PDF y Excel (XLS/XLSX/XLSM).

- Los archivos se guardan en las carpetas `Xino` y `Niros` del volumen `archivo_it_data`.
- La web y los bots muestran y buscan solo en esas dos secciones. No hay otras categorías ni apartado de claves privadas. Si el volumen tiene archivos o claves de una versión anterior, no se borran, pero ya no se muestran.
- En el buscador, `cat:xino` o `cat:niros` filtra por sección.
- Para cambiar los nombres, editá `CATEGORIES` en `server.js` y `CATS` y los botones de la barra lateral en `public/index.html`.

## Búsqueda

La búsqueda (web y bots) ignora acentos y mayúsculas, ordena por relevancia (primero coincidencias en el nombre, después en la ruta y en el contenido) y, si no hay coincidencias exactas, muestra los resultados más parecidos para tolerar errores de tipeo.

| Escribí | Resultado |
|---|---|
| `backup nas` | Archivos que contienen todas las palabras |
| `"backup diario"` | Frase exacta |
| `backup -erp` | Excluye archivos que contienen “erp” |
| `tipo:pdf` | Filtra por formato: pdf, word, excel, texto |
| `ext:ps1` | Filtra por extensión |
| `cat:proced` | Filtra por categoría |

En la web: `/` o `Ctrl+K` enfoca el buscador, `↑ ↓` recorre resultados, `Enter` abre la vista previa y `Esc` cierra ventanas. Dentro de la vista previa, `Ctrl+F` busca en el archivo y `Ctrl+S` guarda al editar. La búsqueda queda en la dirección del navegador, así que se puede recargar o guardar como favorito.

El texto extraído se conserva en memoria y solo se vuelve a leer un archivo cuando cambia su fecha o tamaño; las búsquedas son más rápidas con bibliotecas grandes.

## Bot de Telegram (opcional)

1. En Portainer, agregá `TELEGRAM_BOT_TOKEN` con el token de BotFather y dejá `TELEGRAM_ALLOWED_USERS` vacío por ahora. Redeplegá el Stack.
2. Abrí un chat privado con tu bot y enviá `/id`. El bot responde únicamente con tu ID numérico; no muestra datos hasta autorizarlo.
3. En Portainer, agregá ese ID en `TELEGRAM_ALLOWED_USERS` y redeplegá. Para más usuarios, separá los IDs con comas. No compartas el token ni lo subas al repositorio.
4. En el chat privado, escribí `backup` o `/buscar backup`. El bot lista hasta 10 coincidencias por nombre o contenido. Respondé con el número para recibir el texto extraído. Para agregar información, enviá `/agregar` para elegir entre los primeros 10 archivos, o `/agregar backup` para buscar archivos por nombre. Elegí uno, mandá el texto, revisá la vista previa y confirmá con `/confirmar`; `/cancelar` descarta la operación. Las opciones y confirmaciones vencen a los 10 minutos.

## Bot de Discord (opcional)

Funciona igual que el de Telegram (misma búsqueda, mismo `agregar` con confirmación) y puede usarse en paralelo. Atiende **solo mensajes directos** y solo IDs autorizados; en canales de servidores no responde.

1. En discord.com/developers/applications creá una aplicación, abrí **Bot**, tocá **Reset Token** y copiá el token. No hace falta activar ningún "Privileged Gateway Intent" para mensajes directos.
2. En **OAuth2 > URL Generator** marcá el scope `bot` (y el permiso *Send Messages*), abrí la URL generada e invitá el bot a un servidor tuyo. Hace falta compartir un servidor con el bot para poder escribirle por mensaje directo.
3. En Portainer agregá `DISCORD_BOT_TOKEN`, dejá `DISCORD_ALLOWED_USERS` vacío por ahora y redeplegá.
4. Escribile `!id` al bot por mensaje directo. Copiá el número en `DISCORD_ALLOWED_USERS` (varios, separados por coma) y redeplegá.
5. Uso: escribí `backup` o `!buscar backup`, respondé con el número para ver el contenido, y `!agregar`, `!confirmar`, `!cancelar` para sumar texto. En Discord los comandos usan `!` (la barra `/` la reserva Discord). Las respuestas llegan en bloque de código para conservar claves y símbolos exactos y poder copiarlos.

Como Telegram, el bot de Discord se conecta hacia afuera (no necesita abrir puertos). Si cambiás `package.json`, hay que **reconstruir la imagen** (Redeploy con *Re-pull image / rebuild*).

## Búsqueda por voz (opcional)

Con el servicio Whisper instalado (stack aparte `whisper`), podés mandar un **mensaje de voz** al bot de Telegram o de Discord (por mensaje directo) y lo transcribe y busca como si lo hubieras escrito.

1. Desplegá el stack `whisper` y anotá su dirección, por ejemplo `http://IP-DEL-SERVIDOR:9000`.
2. En este Stack agregá `WHISPER_URL` (esa dirección) y `WHISPER_TOKEN` (la misma clave del stack whisper), y redeplegá.
3. Mantené apretado el micrófono y decí, por ejemplo, "buscá backup". El bot responde "🎙 Entendí: …" y los resultados. Si el audio dura más de 60 segundos (`VOICE_MAX_SECONDS`) lo rechaza.

Reglas de seguridad: solo atiende a IDs autorizados. Si estás dictando texto para `agregar`, el audio se toma como el texto a agregar, pero la confirmación **siempre** se escribe (`/confirmar` o `!confirmar`); por voz no se acepta.

El bot solo atiende chats privados y solo IDs autorizados. Admite el contenido indexable (texto, CSV, Word DOCX, Excel y PDF con texto). No lee Word DOC antiguo; para ese formato, indica usar la web. La función de agregar añade al final únicamente de TXT, MD, CSV, TSV y LOG; otros formatos se protegen para evitar corromperlos.

El bot usa consultas salientes (long polling) a Telegram desde el contenedor; el servidor necesita acceso a Internet. Si el token ya tiene un webhook configurado o un segundo proceso está usando long polling, el bot no puede recibir actualizaciones simultáneamente: usá un bot dedicado o desactivá el otro método antes de habilitarlo. La aplicación no elimina webhooks automáticamente.

El selector de carpeta permite subir una carpeta completa desde tu PC a la sección elegida (Xino o Niros). Los archivos se copian al servidor; los originales permanecen en su ubicación.

## Generar secretos en PowerShell

```powershell
[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
```

Usá una salida para `SESSION_SECRET`; creá una contraseña distinta para `APP_PASSWORD`. Guardalas en el gestor de contraseñas, no en GitHub.

No subas archivos `.env`, `stack.env` ni credenciales al repositorio. `.gitignore` excluye formatos de credenciales, documentos y datos habituales; verificá los archivos del repositorio antes de hacerlo público.

## Datos y límites

- El volumen Docker contiene los documentos cargados y debe incluirse en tu estrategia de copias de seguridad cifradas.
- El índice se reconstruye al consultar; no se guarda una copia de texto en otra base de datos.
- Los archivos de sesión se guardan en el volumen protegido y no aparecen en la biblioteca.
- El sistema permite búsquedas en PDF con texto seleccionable; los PDF escaneados no se reconocen por OCR.
- La autenticación usa un usuario y contraseña compartidos configurados como variables del Stack. La sesión dura hasta 8 horas.
- Los documentos del volumen no se cifran individualmente por la aplicación. Protegé el disco y los respaldos del servidor.
- Las sesiones duran hasta 8 horas. Cambiar el secreto de sesión las invalida.

## Copias de seguridad

Respaldá el volumen `archivo_it_data` desde el host o con la solución de backup de Docker que uses. Probá la restauración y guardá el backup cifrado. No agregues el contenido del volumen al repositorio.






