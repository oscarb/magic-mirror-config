# Magic Mirror

Configuration and documentation for my Magic Mirro, using the awesome [MagicMirror²](https://github.com/MichMich/MagicMirror) platform.

## Features

* Turns on/off based on motion detection from camera and nearby motion detector
* Doubles as an hidden security camera
* Custom compliments using a remote "compliments server"

## Hardware

* Frame
* Pilkington MirroView glass
* Samsung Galaxy Tab S2

Most Magic Mirrors I've seen uses computer monitors connected to a Raspberry Pi. My setup however uses an Android tablet. Although tablets with big screens are hard to come by using a tablet has many benefits:

- *OLED* - The Samsung Galaxy Tab has an OLED screen so whenever something on the screen is black those pixels are turned off. This makes the screen blend in better behind the spy glass. Computer screens with OLED are hard to come by and like OLED TV:s quite expensive.
- *Depth* - compared to computer monitors the tablet has a very small physical footprint, thus the mirror becomes both lightweight and thin.
- *All-in-one* - a tablet is basically a computer, screen, speaker, camera and microphone combined into one so no need to make room within the mirror for extra devices.

### Assembly

I got in contact with a [glazier](https://www.angbyglas.com/) that could set me up with both the frame and the glass for a reasonable price. Once I had the frame and the glass I attached the tablet to a black paper with the same size as the frame and cutouts for the screen and the front-facing camera. A cardboard was then used to hold the tablet in place together with two bars firmly pushing the cardboard and the tablet against the glass. Remember to make a cut-out in the cardboard so the USB-cable powering the device will fit. 

Even though it's not too difficult to remove the tablet I would strongly recommend to pair a bluetooth mouse with the tablet to control it remotely.

## Software

This setup runs MagicMirror hosted on a local server in a fullscreen browser on the tablet.

### Android tablet

* Tasker
* AutoRemote
* Fully Kiosk Browser
* IP Webcam

Assign a static IP to tablet in router settings

#### Tasker

*Profile 1: Device boot*
On device boot:
- Activate AutoRemote WiFi

*Profile 2: On message received*
On message "on" received in AutoRemote:
- Turn on screen

### Server

* MagicMirror in Docker
* Synology 




## Resources 

* [Regions](https://forum.magicmirror.builders/topic/286/regions/2)
