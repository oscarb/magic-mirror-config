# Magic Mirror

Configuration and documentation for my Magic Mirror, using the awesome [MagicMirror²](https://github.com/MichMich/MagicMirror) platform.

## Features

* Turns on/off based on motion/sound detection from camera and nearby motion detector
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

This setup runs MagicMirror hosted on a local Synology DS713+ server in a fullscreen browser on the tablet.

### Android tablet

* Android Settings
* Tasker
* Fully Kiosk Browser
* IP Webcam

Assign a static IP to tablet in router settings

#### Android Settings

* *Sound* - Unless you want it, turn off the sound to avoid nasty surprises
* *Notifications* - Disable for all apps except _Fully Kiosk Browser_, _IP Webcam Pro_ and _Tasker_
* *Display* 
  - Turn up the brightness to max to be able to easily see the screen in well list environments
  - Set display timeout to 10 minutes of inactivity
* *Battery* - disable optimization for _Fully Kiosk Browser_, _IP Webcam Pro_ and _Tasker_
* *Screen lock* - Set screen lock type to _None_ so _Fully Kiosk Browser_ can show Magic Mirror page when display turns on
* *Developer options* - Enable USB debugging in order to use *scrcpy* for remote management


#### Tasker

```
Profile: Turn on display on sound and motion (4)
    Restore: no
    State: Display State [ Is:Off ]
    State: IP Webcam Pro [ Configuration:Motion is detected/timed out ]
    State: IP Webcam Pro [ Configuration:Sound is detected/timed out ]
Enter: Turn On Screen (15)
    A1: Turn On [ Block Time (Check Help):500 ] 
```

```
Profile: Always show Magic Mirror when display turns on (19)
    Restore: no
    Event: Display On
Enter: Start Magic Mirror (3)
    A1: Launch App [ Package/App Name:Fully Kiosk Browser Data: Exclude From Recent Apps:Off Always Start New Copy:Off ] 
```

*Profile 2: On message received*
On message "on" received in AutoRemote:
- Turn on screen

#### Fully Kiosk Browser

* *Web Content Settings*
  - Set the Start URL to point to your Magic Mirror URL
* *Web Zoom and Scaling*
  - Enable _View in Dekstop Mode_
* *Web Auto Relad*
  - Enable _Auto Reload on Screen On_ in order to fetch the most current Comoliments Server config.
* *Remote Administration*
  - Enable remote administration to be able to turn on and off display from external motion sensor


### Server

* MagicMirror in Docker
* Synology 

## Remote Management

### Bluetooth Mouse

Pair a bluetooth mouse before the tablet is put into the frame to easily control the tablet without touch.

### scrcpy

I use [scrcpy](https://github.com/Genymobile/scrcpy) to display and control my tablet from my Windows and MacBook computer.

#### Setup

1. Enable USB debugging on the tablet
2. Connect a USB-cable to the tablet and run

    adb tcp 5555


#### Usage

```
adb connect 192.168.1.100
scrcpy -b 6M -m 800 -s 192.168.1.100:5555
```

## Updating

```
docker-compose pull magic-mirror
docker-compose down
docker-compose up -d
```

## Resources 

* [Regions](https://forum.magicmirror.builders/topic/286/regions/2)
