/**
 * This script handles all page animations and interactions.
 */

// Quiz functionality
function initializeQuiz() {
    const generateQuizBtn = document.getElementById('generate-quiz');
    const fileUpload = document.getElementById('file-upload');
    const notesInput = document.getElementById('notes-input');
    const quizSection = document.getElementById('quiz-section');
    const fileUploadSection = document.getElementById('file-upload-section');

    if (generateQuizBtn) {
        generateQuizBtn.addEventListener('click', () => {
            if (notesInput.value.trim() !== '') {
                fileUploadSection.style.display = 'none';
                quizSection.style.display = 'block';
                generateQuizFromNotes(notesInput.value);
            }
        });
    }

    if (fileUpload) {
        fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    notesInput.value = e.target.result;
                };
                reader.readAsText(file);
            }
        });
    }
}

// Main document ready function
document.addEventListener('DOMContentLoaded', () => {
    // Initialize quiz if we're on the quiz page
    initializeQuiz();

    // --- 1. NAVBAR ACTIVE LINK SCROLLSPY ---
    
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('nav ul li a');

    if (sections.length > 0 && navLinks.length > 0) {
        const navObserverOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.6 // 60% of the section must be visible
        };

        const navObserverCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const visibleSectionId = entry.target.id;
                    
                    navLinks.forEach(link => {
                        link.classList.remove('active');
                        // Check if link's href matches the section's ID
                        if (link.getAttribute('href') === `#${visibleSectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        };

        const navObserver = new IntersectionObserver(navObserverCallback, navObserverOptions);
        
        sections.forEach(section => {
            navObserver.observe(section);
        });
    }

    // --- 2. SCROLL-TRIGGERED FADE-IN ANIMATIONS ---
    
    const animatedElements = document.querySelectorAll('.reveal-on-scroll');

    if (animatedElements.length > 0) {
        const scrollObserverOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15 // Trigger when 15% of the element is visible
        };

        const scrollObserverCallback = (entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Add the 'visible' class to trigger the CSS transition
                    entry.target.classList.add('visible');
                    
                    // Stop observing this element once it's visible
                    observer.unobserve(entry.target);
                }
            });
        };

        const scrollObserver = new IntersectionObserver(scrollObserverCallback, scrollObserverOptions);

        animatedElements.forEach(el => {
            scrollObserver.observe(el);
        });
    }

});