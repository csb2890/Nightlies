document.addEventListener('DOMContentLoaded', function () {

    window.tvDB = new tvDB();
    window.faves = new Favorites();
    window.thePirateBay = new ThePirateBay();
    window.GUI = new Gui();

});

var Favorites = klass({
    faves: [],
    target: '#favorites',
    element: '#favoriteslist',

    initialize: function () {
        $(document.body).on('click', 'button.addtofavorites', this.add.bind(this));
        $(document.body).on('click', 'input.removefromfaves', this.remove.bind(this));
        this.element = $(this.element);
    },

    add: function(e) {
        var parent = $(e.target).parent('li');
        var id = parent.attr('data-name');
        if(!this.has(id)) {
            this.faves.push({
                id: parent.attr('data-id'),
                name: parent.attr('data-name'),
                banner: parent.find('img').attr("src"),
                overview: parent.find('p').text(),
                nextepisode: 'fetching...',
                nextairdate: 'fetching...',
                date: 'fetching...'
            });
            this.save();
            window.tvDB.findEpisodes(parent.attr('data-id'), function(epis) {
                console.log("Found episodes for ", id," after adding!");
            });

        }
        this.show();
    },

    has: function(id) {
        for(i=0; i<this.faves.length;i++) {
            if(this.faves[i].id == id) return true;
        }
        return false;
    },

    remove: function(e) {
        var id = $(e.target).parent('div[data-name]').attr('data-id');
        localStorage.removeItem("serie."+id);
        this.faves = this.faves.filter(function (obj) {
            return obj.id != id;
        });
        this.save();
        this.show();
    },

    setNextEpisode: function(show, info) {
        for(var i=0; i<this.faves.length; i++) {
            if(this.faves[i].id == show) {
                this.faves[i].nextepisode = info;
                var next = new Date(Date.parse(info.firstaired));
                this.faves[i].nextepisode.date = next > new Date() ? 'in ' + humaneDate(next) : humaneDate(next);
                this.save();
                this.element.html(ich.showFavorites({ favorites: this.faves }));
            }
        }
    },

    read: function() {
        var faves = localStorage.getItem("favorites");
        if(faves) this.faves = JSON.parse(faves);
    },

    save: function() {
        localStorage.setItem("favorites", JSON.stringify(this.faves));
    },

    show: function() {
        this.read();
        window.location.hash = this.target;
        for(i=0; i<this.faves.length; i++) {
            if(!this.faves[i].escaped) this.faves[i].escaped = this.faves[i].name.replace(/\'/g, "\'");
            window.tvDB.findEpisodes(this.faves[i].id);
        }
        this.element.html(ich.showFavorites({ favorites: this.faves }));
        $(document.body).append(ich.showFavorite({ favorites: this.faves }));
        $("#favorites").show();
    }
});


var Gui = klass({

    initialize: function() {
      
        $(document.body).on('click', '.goback', function () {
            window.location.hash = '#favorites';
            return false;
        });

        $('form#seriesearch').on('submit', this.findSerie);
        $('#searchresult').on('click', 'button.getschedule', this.selectShow);
        $('#favorites').on('click', 'li', this.selectShow);

        $(document.body).on('click', 'div[data-name] table td:last-child img[alt="Magnet link"]', this.findTpbSerie);
        $(document.body).on('click', 'button.mirrorsearch', this.tpbMirrorSearch);
        $('form#tpbsearch').on('submit', this.findGeneric);
        $(document.body).on("click", "a", this.launchMagnetLink);
        window.faves.show();
    },

    launchMagnetLink: function (e) {
       chrome.tabs.create({'url':this.href }, function (tab) {
            setTimeout(function () {
                chrome.tabs.remove(tab.id);
            }, 5000);
        });
        return false;
    },

    /**
     * DO a TPB search on a mirror. Inserts a row after the current if it's not there yet.
     */
    findTpbSerie: function(e) {
        var self = $(e.target);

        var what = $(this).closest('div[data-name]').attr('data-name');
        var ep = self.closest('tr').attr('data-episode');
        var target = $(self.closest('tr')[0]).next();
        if(!$(target[0]).hasClass('result')) {
            $(self.closest("tr")[0]).after("<tr class='result'><th colspan='4'>Searching...</th></tr>");
            target = self.closest("tr").next('tr.result');
        }
        else {
            $(target).empty().append("<th colspan='4'>Searching...</th>");
        }
        window.thePirateBay.search(what+' '+ep, function(res) {
             res.results.ep = ep;
             res.results.what = what;

             target = $(target).hasClass("result") ? target.empty() : target.after('<tr class="result"></tr>');
             res = (!res.error) ? ich.showTpbResults(res.results)[0].outerHTML : res.results;
             $(target).html('<td colspan="4">'+res+'</td>');
        }, 1);
    },

    /**
     * Request an alternative mirror of one is down.
     */
    tpbMirrorSearch: function(e) {
        var query = $(this).attr('data-query');
        var target = $(this).closest("tr.result");
        $(this).text("Finding an alternative TPB mirror...");
        window.thePirateBay.findAlternativeMirror(query, function(res) {
             target = $(target).hasClass("result") ? target.empty() : target.after('<tr class="result"></tr>');
             res = (!res.error) ? ich.showTpbResults(res.results)[0].outerHTML : res.results;
             $(target).html('<td colspan="4">'+res+'</td>');
        }, 1);
    },

    /**
     * Do a generic TPB search on a mirror.
     */
    findGeneric: function(e) {
        var what = $('input[type=search][name=tpb]').val();
        
        $("#searching").css("display", "block");
        $("#searchresult").empty();
        window.location.hash = 'searching';
        $("#searchresult").empty();
        window.thePirateBay.search(what, function(res) {
            res = (!res.error) ? ich.showTpbResults(res.results)[0].outerHTML : res.results;
            $('#searchresult').html("<li><table class='shows'><tr><td>"+res+'</td></tr></table></li>');
        });
        return false;
    },

    findSerie: function(e) {
        window.location.hash = 'searching';
        var name = $('input[type=search][name=series]').val();
        $("#searching").css("display", "block");
        $("#searchresult").empty().html("<p>Please wait. Searching...</p>");
        window.tvDB.findSeries(name, function(results) {
            $("#searchresult").empty().append(ich.showSearchResult(results));
        });
        return false;
    },

    selectShow: function(e) {
        
        var id = $(this).attr('data-id');
        window.location.hash = '#show_' + id;
        var schedule = $("div[data-id='" + id + "'] table.shows");
        schedule.empty();
        window.scrollTo(0,1);
        window.tvDB.findEpisodes(id, function(epis) {
            console.log("show!", epis);
            schedule.append(ich.showEpisodes(epis));
        });
    },

    notifyUpdates: function(amount) {
        chrome.browserAction.setBadgeText({text: amount});
        chrome.browserAction.setBadgeBackgroundColor({color: "#000000"});
        var notification = webkitNotifications.createHTMLNotification('notification.html');
        notification.show();
    }
});

var tvDB = klass({
    seriesSearch: 'http://thetvdb.com/api/GetSeries.php?seriesname=%s',
    episodeSearch: 'http://thetvdb.com/api/646990DA07A98A2B/series/%s/all/en.xml',

    initialize: function () {

    },

    findSeries: function(name, cb) {
         $.ajax({
                url: this.seriesSearch.replace('%s', encodeURIComponent(name)),
                dataType:'xml',
                success: function(xhr, status) {
                    cb(this.parseSeries(xhr,status));
                }.bind(this)
         });
        return false;
    },

    findEpisodes: function(showID, cb) {
         var cached = localStorage.getItem("serie."+showID);
         
         if(!cached) {
            $.ajax({
                url: this.episodeSearch.replace('%s', showID),
                dataType:'xml',
                success: function(xhr, status) {
                    var result = this.parseEpisodes(xhr,status);
                    if(cb) cb(result);
                    window.faves.setNextEpisode(showID, this.findNextEpisode(result.episodes));
                    localStorage.setItem("serie."+showID, JSON.stringify({lastCached: new Date().getTime(), episodes: result.episodes }));
                }.bind(this)
            });
        }
        else {
            cached = JSON.parse(cached);
            console.log("From cache!", cached);
            window.faves.setNextEpisode(showID, this.findNextEpisode(cached.episodes));
            if(cb) cb(cached);
        }
    },

    findNextEpisode: function(episodes) {
        var curDate = new Date().getTime();
        var prevAirdate = false;
        var epi = false;
        for (i= 0; i< episodes.length; i++) {
            if(episodes[i].firstaired !== '') {
                var airdate = Date.parse(episodes[i].firstaired);
                if(!prevAirdate || (airdate < prevAirdate && airdate >= curDate)) {
                    prevAirdate = airdate;
                    epi = episodes[i];
                }
            }
        }
        return epi;
    },

    parseEpisodes: function (xhr, status) {
        var curDate = new Date().getTime();
        var epis = $(xhr).find("Episode");
        var data = [];
        for (var i = epis.length - 1; i > 0; i--) {
            var sn = $(epis[i]).find("SeasonNumber").text();
            var en = $(epis[i]).find("EpisodeNumber").text();
            data.push({
                season: (sn.length == 1) ? "0" + sn : sn,
                episode: (en.length == 1) ? "0" + en : en,
                episodename: $(epis[i]).find("EpisodeName").text(),
                firstaired: $(epis[i]).find("FirstAired").text(),
                magnet: !(($(epis[i]).find("FirstAired").text() === '' || Date.parse($(epis[i]).find("FirstAired").text()) > curDate))
            });
        }
        return {episodes: data};
    },

    parseSeries: function(xhr, status, callback) {
        var series = $(xhr).find("Series");
        var results = [];
        for (i = 0; i < series.length; i++) {
            var banner = $(series[i]).find("banner").text();
            results.push({
                id: $(series[i]).find("id").text(),
                escaped: $(series[i]).find("SeriesName").text().replace(/\'/g, "\'"),
                banner: banner !== '' ? "http://thetvdb.com/banners/" + banner : "",
                name: $(series[i]).find("SeriesName").text(),
                overview: $(series[i]).find("Overview").text()
            });
        }
        return({ searchresults: results});
    }
});

ThePirateBay = klass({
    p720: false,
    mirror: false,
    query: "search/%s/0/7/0/",
    howmany: 1,
    initialize: function() {
        this.set720p(localStorage.getItem("search.720p") == 1);
        this.setMirror(localStorage.getItem("search.mirror"));
    },

    set720p: function(how) {
        this.p720 = how;
        localStorage.setItem("search.720p", how);
    },

    setMirror: function(to) {
        this.mirror = to;
        localStorage.setItem("search.mirror", to);
    },

    search: function(what,callback, howmany) {
        $.ajax({
            url: this.mirror + this.query.replace('%s', encodeURIComponent(what) + (this.p720 ? ' 720p' : '')),
            success: function(xhr, status) {
                var results = this.parseTPBResult(xhr, status, howmany);
                if(results.length > 0 && xhr.indexOf('magnet:') === -1) {
                    //$(self).text("This mirror doesn't support Magnet links. (click to find another)");
                    callback({
                        error: true,
                        results: this.tpbErrorHandler(xhr,status,what)
                    });
                } else {
                    callback({
                        error: false,
                        results: results
                    });
                }
            }.bind(this),
            error: function(xhr,status) {
                callback({
                    error: true,
                    results: this.tpbErrorHandler(xhr, status, what)
                });
            }.bind(this)
        });
    },

    /**
     * Find an alternative mirror from fucktimkuik.org. Then set that if tests are ok.
     * Finally, execute the original callback.
     */
    findAlternativeMirror: function(what, callback, howmany) {
        fuckTimKuik(function(newMirror) {
            this.mirror = newMirror;
            this.search(what, function(result) {
              if(!result.error) this.setMirror(newMirror); // result is ok. store new mirror.
              callback(result);
            }.bind(this), howmany);
        }.bind(this));
    },

    /**
     * Format a TPB Searchresult and inject it into the target.
     */
    parseTPBResult: function(xhr, status, maxResults) {
        var row = $(xhr).find('#searchResult tbody tr');
        maxResults = maxResults || row.length;
        var out = [];
        if(row && row.length > 0) {
             for(i=0; i<maxResults;i++) {
                out.push({
                    releasename :  $(row[i]).find('td:nth-child(2) > div ').text(),
                    magnetlink : $(row[i]).find('td:nth-child(2) > a')[0].outerHTML.replace(/img src=\"(.*)\/img\/icon-magnet.gif\"/igm, 'img src="static/img/icon-magnet.gif"'),
                    seeders:  $(row[i]).find("td:nth-child(3)").html(),
                    leechers: $(row[i]).find("td:nth-child(4)").html()
                });
           }
        }
       return { results: out };
    },

    /**
     * Handle erros when tpb is down. with tpb mirrorsearch.
     */
    tpbErrorHandler: function(xhr, status, query) {
        console.log("ERROR!", xhr, status, query);
        return ich.showTpbError({
            mirror: this.mirror,
            status: xhr.status,
            statusText: xhr.statusText,
            query: query
        })[0].outerHTML;
    }
});