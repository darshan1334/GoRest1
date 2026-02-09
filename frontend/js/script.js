document.addEventListener('DOMContentLoaded', () => {
    console.log("GoRest Landing Page Loaded");

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Simple interaction for "Report an Issue"
    const reportBtn = document.querySelector('.btn-secondary');
    if (reportBtn) {
        reportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            alert("Report feature coming soon! For now, please email support@gorest.com");
        });
    }
});
