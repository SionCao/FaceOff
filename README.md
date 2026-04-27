# FaceOff
# By XinyueCao

## Short Description
Face Off is an interactive computational artwork that transforms real-time facial capture into falling “face balls”, using gameplay to explore how friction between human behaviour and computational systems generates new forms of interaction and relation.

## Concept / Intent
This project explores the relationship between human bodies and computational systems through playful friction. The player’s face is captured by the webcam and transformed into falling “face balls,” while body tracking and sensor input turn movement into the main form of interaction. By hitting, missing, and responding to these digital versions of themselves, participants enter a feedback loop between physical action and machine perception. Friction, delay, and misalignment are treated not as errors, but as part of the interaction.

## Technology Used
p5.js – for rendering graphics, game logic, and interaction  
p5.sound – for sound effects and real-time audio manipulation  
ml5.js (BodyPose) – for real-time body tracking and collision detection  
Webcam (Video Capture) – for capturing the player’s face and movement  
Arduino – for reading pressure sensor input from the dance mat  
Web Serial – for communication between Arduino and the browser  
FSR Sensors (Force Sensitive Resistors) – for detecting stepping input on the dance mat  

## Technology Used

The work is developed using p5.js (JavaScript) as a browser-based computational environment, with additional support from the p5.sound library for audio playback and manipulation. The system runs in real time within a web browser and is designed for embodied audiovisual interaction.

Visual input is captured through a live webcam feed and processed using ml5.js BodyPose. Key body points are tracked and translated into interactive data, enabling collision detection between the player’s movement and the falling objects. The player’s face is extracted from the video stream and re-rendered as a texture, transforming live image data into dynamic game elements :contentReference[oaicite:0]{index=0}.

Temporal behaviour in the system is structured through discrete timing logic using the millis() function in p5.js. Game states such as face alignment, countdown, gameplay, and game over are controlled through timed transitions, allowing the work to introduce moments of pause, anticipation, and escalation.

Sound operates as an active and responsive layer. Using p5.SoundFile and audio filters (LowPass and HighPass), the background music dynamically shifts in response to player input. Playback rate, frequency filtering, and volume are continuously modulated, creating a real-time relationship between movement, sound, and system state.

Physical interaction is extended through an Arduino Uno connected via the Web Serial API. Five FSR (force-sensitive resistor) sensors embedded in a dance mat detect stepping pressure and send data to the browser. These inputs are parsed and mapped to directional controls, affecting both audio behaviour and game mechanics.

Together, these technologies form a hybrid system combining computer vision, sound synthesis, and physical computing, where visual, auditory, and bodily inputs are continuously interlinked.

## How It Works
FaceOff runs in a web browser and uses the webcam, audio system, and optional Arduino input in real time. Open the project (via GitHub Pages or a local server), allow camera access when prompted, and click once to enable audio.

Press K to connect the Arduino via Web Serial (Chrome or Edge required), then step on the center pad to begin the face capture process. Align your face inside the on-screen guide and hold still for a short countdown. Once captured, the game starts automatically.

During gameplay, interaction is controlled through full-body movement and the dance mat. The player hits falling “face balls” using tracked body points, while stepping on directional pads modifies sound and ball behaviour in real time. If no Arduino is connected, the game can still be started using the keyboard (Space key).

The work is presented as a single-screen interactive setup. A laptop or display with an active webcam is positioned facing the participant, with audio played through speakers or headphones. The experience is designed for one participant at a time, standing within the camera frame so their body movement and captured face directly influence the system in real time.

## Requirements
Operating System:** macOS / Windows (tested in browser environment)  
Development Environment: p5.js (JavaScript) / Visual Studio Code (recommended)  
Browser: Google Chrome (recommended for webcam, audio, and Web Serial support)  
Hardware:Laptop or desktop computer / Built-in or external webcam / Speakers or headphones / Projector for installation display / Arduino Uno with FSR sensors (dance mat input)

## Libraries / Frameworks:**  
- p5.js  
- p5.sound  
- ml5.js (BodyPose)

## Screenshots / Media
The following images document the gameplay, setup, and interaction of FaceOff.  
Together, they illustrate how the system captures the player’s face, translates it into game elements, and responds to bodily movement and sensor input in real time.

## Credits / Acknowledgements
FaceOff was created by Xinyue Cao as part of Term 2 coursework in Computational Arts.

The work builds on experiments in embodied interaction, computer vision, and audiovisual gameplay.  
Technical references and inspirations include:

- p5.js reference documentation  
- p5.sound library documentation  
- ml5.js BodyPose documentation  
- Web Serial communication between Arduino and browser  
- Timing and interaction logic inspired by The Coding Train (Daniel Shiffman)

- Acknowledgements： Rokeby, D. (1990). Very Nervous System. http://www.davidrokeby.com/vns.html

- Acknowledgements： Porter, B. (2010) PlayStation 2 Controller Arduino Library v1.0. http://www.billporter.info/2010/06/05/playstation-2-controller-arduino-library-v1-0/

- Acknowledgements: Hall, R. (n.d.) Physical Computing 1: Week 5 – Serial Communication and JSON. Course lecture slides. 

- Acknowledgements: ml5.js. BodyPose Reference. https://docs.ml5js.org/#/reference/bodypose

- Acknowledgements: p5.js Reference — createGraphics() https://p5js.org/reference/p5/createGraphics/

- Acknowledgements： Shiffman, D. (2012). The Nature of Code. https://natureofcode.com

## License
This project is shared for educational and research purposes.  
All rights reserved by the artist.

## Contact / Links
https://github.com/SionCao/SIONCAO

## Vimeo video
https://youtu.be/LWlJIYdC-hY
