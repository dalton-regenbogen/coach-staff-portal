document.addEventListener("DOMContentLoaded", function() {
  const typewriterElement = document.getElementById('typewriter');
  const finalMessageElement = document.getElementById('finalMessage');
  
  // Retrieve and parse the JSON from the data attribute
  const linesData = typewriterElement.getAttribute('data-lines');
  let lines = [];
  try {
    lines = JSON.parse(linesData);
  } catch (e) {
    console.error("Error parsing typewriter lines:", e);
  }
  
  let lineIndex = 0;  // Which line we're on
  let charIndex = 0;  // Which character in the current line
  let isDeleting = false;
  
  // Timing parameters (in milliseconds)
  const typingSpeed = 100;
  const deletingSpeed = 50;
  const pauseAfterTyping = 500;
  const pauseAfterDeleting = 500;
  
  function typeEffect() {
    const currentLine = lines[lineIndex];
    
    if (!isDeleting) {
      // Typing: add one character at a time
      typewriterElement.textContent = currentLine.substring(0, charIndex);
      charIndex++;
      
      if (charIndex > currentLine.length) {
        if (lineIndex < lines.length - 1) {
          // If not the last line, pause then start deleting
          setTimeout(() => {
            isDeleting = true;
            typeEffect();
          }, pauseAfterTyping);
        } else {
          // For the final line, stop deletion and show the final message
          setTimeout(() => {
            typewriterElement.style.opacity = 0;
            document.querySelector('.caret').style.display = "none";
            finalMessageElement.style.opacity = 1;
            finalMessageElement.style.transform = "translateY(0)";
          }, pauseAfterTyping);
          return;
        }
      } else {
        setTimeout(typeEffect, typingSpeed);
      }
    } else {
      // Deleting: remove one character at a time
      typewriterElement.textContent = currentLine.substring(0, charIndex);
      charIndex--;
      
      if (charIndex < 0) {
        // Finished deleting, move to the next line
        isDeleting = false;
        lineIndex++;
        charIndex = 0;
        setTimeout(typeEffect, pauseAfterDeleting);
      } else {
        setTimeout(typeEffect, deletingSpeed);
      }
    }
  }
  
  typeEffect();
});
