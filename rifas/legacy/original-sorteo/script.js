const apiURL = "https://script.google.com/macros/s/AKfycbwBkSM63GWFwC7O4ZZkWnNN_s2lYn0-4Mcke6CigPQZmJD2b_UMnl87aXKCc6AYQAbrWA/exec"; // Reemplazá con tu URL real

// Cargar números disponibles
fetch(`${apiURL}?action=getDisponibles`)
  .then(res => res.json())
  .then(data => {
    const select = document.getElementById("numero");
    select.innerHTML = '<option value="" disabled selected>Seleccioná un número</option>';
    data.numeros.forEach(num => {
      const option = document.createElement("option");
      option.value = num;
      option.text = num;
      select.add(option);
    });
  })
  .catch(() => {
    const select = document.getElementById("numero");
    select.innerHTML = '<option value="" disabled selected>Error al cargar números</option>';
  });

document.getElementById("formulario").addEventListener("submit", function(e) {
  e.preventDefault();

  const btn = this.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.textContent = "Enviando...";
  btn.disabled = true;

  const datos = new FormData(this);

  fetch(apiURL, {
    method: "POST",
    body: datos
  })
    .then(res => res.json())
    .then(response => {
      const msg = document.getElementById("mensaje");
      if (response.estado === "ok") {
        msg.textContent = `✅ ¡Inscripción exitosa! Tu número es el ${response.numero}`;
        msg.className = "success";
        this.reset();
      } else {
        msg.textContent = "❌ Ese número ya fue elegido. Elegí otro.";
        msg.className = "error";
      }
    })
    .catch(() => {
      const msg = document.getElementById("mensaje");
      msg.textContent = "❌ Error de conexión. Intentá de nuevo.";
      msg.className = "error";
    })
    .finally(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    });
});
