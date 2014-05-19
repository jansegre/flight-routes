dist = ./dist
# phonegap may work as well
cordova ?= cordova

.PHONY:
all: build

$(dist):
	$(cordova) create $(dist) com.jansegre.flightroutes FlightRoutes
	cd $(dist) && $(cordova) platform add android

.PHONY:
copy: $(dist)
	rm -r $(dist)/www/*
	cp index.html tam*.json world*.json *.css $(dist)/www/
	echo '<script src="cordova.js"></script>' >> $(dist)/www/index.html

.PHONY:
build: copy
	cd $(dist) && $(cordova) build --release

.PHONY:
emulate:
	cd $(dist) && $(cordova) emulate
