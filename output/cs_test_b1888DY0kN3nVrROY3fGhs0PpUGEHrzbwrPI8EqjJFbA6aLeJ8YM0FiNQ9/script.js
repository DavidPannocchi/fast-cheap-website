document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const mobileToggle = document.querySelector('.mobile-toggle');
  const navMenu = document.querySelector('.nav-menu');

  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
    });

    // Close menu when clicking nav links
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('active');
      });
    });
  }

  // Booking Form Mailto Handler
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const nome = document.getElementById('nome').value;
      const email = document.getElementById('email').value;
      const telefono = document.getElementById('telefono').value;
      const servizio = document.getElementById('servizio').value;
      const messaggio = document.getElementById('messaggio').value;

      const subject = encodeURIComponent(`Richiesta Prenotazione drnomi - ${nome}`);
      const body = encodeURIComponent(
        `Richiesta di prenotazione dal sito drnomi:\n\n` +
        `Nome: ${nome}\n` +
        `Email: ${email}\n` +
        `Telefono: ${telefono}\n` +
        `Servizio selezionato: ${servizio}\n\n` +
        `Note/Messaggio:\n${messaggio}`
      );

      window.location.href = `mailto:wesiceb864@copawoke.com?subject=${subject}&body=${body}`;
    });
  }
});