FROM pierrezemb/gostatic
COPY index.html /srv/http/index.html
COPY css /srv/http/css
COPY js /srv/http/js
CMD ["-port", "8080", "-log-level", "info"]
