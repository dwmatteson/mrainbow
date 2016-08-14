# mrainbow
Meeting Rainbow; a meeting agenda web app using Node and Angular 1.3

## Introduction

I created Meeting Rainbow a few years ago because I couldn't find meeting agenda software that I 
liked. I also had been looking for a project to do as a single page web application talking to a 
Node API. The backend has stayed pretty much the same since the original version, but there are
two versions of the front end, both of which I've left in the repository.

I have used this quite a bit and it worked for my purposes, but I provide it totally as-is with
no expectation or promise of bug fixes or updates on my part. At work we switched to SCRUM and
no longer have need for a meeting agenda application like this, so I haven't used it for about
a year.

If you want to try it out it's up and running at meetingrainbow.com but I make no promise that
it will stay there, so if you want to have an installation you can rely on, I recommend setting
it up yourself.

## Setup

### Requirements

* Node (I developed it on 0.10 but it should work on the latest version, assuming all dependencies do.)
* MySQL (5.x+)
* Your HTTP server of choice, I use nginx.

## Steps

1. Point your HTTP server's vhost docroot at one of the SPA folders located in the repository:

### old-www

This is the original version of the interface, written as a single page web application using
Bootstrap and jQuery. This actually worked pretty well, but there are things that could have
been done better, and I think the Angular version is mostly better.

### www

This is the Angular 1.3 version, and the one in use if you go to meetingrainbow.com. It has
some bugs but we were using it until we switched to SCRUM, and now we don't use meeting agenda
software. So it's definitely usable.

2. Set up a database and put the database credentials in mr-server.php and mr-websocket.php.

3. Fire up mr-server.js and mr-websocket.js and set up your HTTP server to pass to the api.

vhost/api/ should pass through to mr-server.js on port 7878. Obviously you can change the port
in the code if desired.

## TODO

Here's some things that I know I should do but make no guarantees of when or if they will
ever happen, since I don't use this software any more.

* Configuration should be in a single configuration file.
* API should probably be RESTful instead of old-style pass an action argument.
* New SPA for RESTful API and either Angular 2.x or something else entirely.
* Write unit tests.

## Contact

You can message me on GitHub @dwmatteson. Pull requests are of course welcome but I make
no guarnatees on timeliness or acceptance.
