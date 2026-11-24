# Frontend de PILAS

Interfaz responsive en HTML, CSS y JavaScript. Desde la raíz del repositorio:

```sh
python -m http.server 5500 --directory frontend
```

Abre [http://127.0.0.1:5500](http://127.0.0.1:5500). El modo inicial es **Simulación**. En el Analizador, elige un caso ficticio y pulsa **Analizar contenido**. Los resultados y conteos se mantienen en memoria hasta recargar la página. El asistente ofrece orientación local basada en los temas del MVP.

## Conectar la API

Levanta FastAPI en el puerto 8000 siguiendo el README de la rama de backend. En la cabecera del frontend, abre **Simulación**, elige **API de PILAS** y pulsa **Aplicar**. Para otra instalación, cambia la etiqueta meta `pilas-api` en `index.html` y configura el origen del frontend en `PILAS_CORS_ORIGINS` del backend.

Los botones de casos ficticios seleccionan la simulación local. Para probar esos mismos casos contra FastAPI en modo demo, carga el caso y luego cambia a **API de PILAS** antes de enviarlo. El comprobante incluido como recurso JavaScript corresponde al PNG ficticio del backend.

Ante un fallo del proveedor, puedes reintentar con la entrada que ya ingresaste o elegir expresamente un caso ficticio. La aplicación muestra el modo recibido en los resultados de simulación.
