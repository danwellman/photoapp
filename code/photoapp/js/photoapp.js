/**
 * @fileOverview Display images using knockout.js and Flickr's REST API
 * @author Dan Wellman
 * @version 0.1
 * @copyright Copyright &copy; Dan Wellman 2013 {@link http://opensource.org/licenses/MIT}
 */

/*global Photoapp, window, $, ko */
/*jslint nomen: true, unparam: true */

/**
 * @constructor
 * @param {object} config
 * @param {string} config.apiKey The Flickr API key required to make requests
 * @param {string} config.photosetId The ID of the photoset we want to work with
 * @this {object} Photoapp
 */
function Photoapp(config) {
    'use strict';

    var managePromise, manageOptions, addWindowHandler, buildRequestUrl, handleDetails, handlePhotos, getImageUrl, defaultSort, titleSort,
        that = this,
        defaults = {
            base: 'https://api.flickr.com/services/rest/?format=json',
            imageSize: 'd',
            sorts: []
        };

    /**
     * Create a promise object for the first request and add success handler
     *
     * @access private
     */
    managePromise = function () {
        that.promise = $.Deferred();

        // make second request when first request finished
        $.when(that.promise).then(that.getPhotos);
    };

    /**
     * Create the options object and add the built-in sorts
     *
     * @access private
     */
    manageOptions = function () {
        that.options = $.extend(defaults, config);
        that.options.sorts.unshift({ name: 'default', sorter: defaultSort }, { name: 'title', sorter: titleSort });
    };

    /** 
     * Add the global jsonFlickerApi() method to the window object
     * @access private
     */
    addWindowHandler = function () {
        var origMethod,
            handlers = {
                'flickr.photosets.getInfo': handleDetails,
                'flickr.photosets.getPhotos': handlePhotos
            };

        // preserve existing Flickr callback
        if (window.jsonFlickrApi) {
            origMethod = window.jsonFlickrApi;
        }

        window.jsonFlickrApi = function (data) {
            if (data.photoset.id === that.options.photosetId) {
                handlers[that.options.method](data);
            }

            if (origMethod) {
                origMethod(data);
            }
        };
    };

    /** 
     * Build URL for requests to Flickr
     * @access private
     * @return {string} The URL for the request
     */
    buildRequestUrl = function () {
        var o = that.options;
        return [o.base, '&method=', o.method, '&photoset_id=', o.photosetId, '&api_key=', o.apiKey].join('');
    };

    /** 
     * Get photoset details from Flickr
     * @access public
     */
    this.getPhotosetDetails = function () {
        that.options.method = 'flickr.photosets.getInfo';
        $.ajax(buildRequestUrl());
    };

    /** 
     * Get photos from Flickr
     * @access public
     */
    this.getPhotos = function () {
        that.options.method = 'flickr.photosets.getPhotos';
        $.ajax(buildRequestUrl());
    };

    /** 
     * Handle the photoset details from Flickr
     * @access private
     * @param {object} data The data returned from Flickr
     */
    handleDetails = function (data) {
        var epoch = parseInt(data.photoset.date_update, 10),
            d = new Date(0),
            short = [];

        d.setUTCSeconds(epoch);
        short.push(d.getDate(), d.getMonth() + 1, d.getFullYear());

        that.viewModel.title(data.photoset.title._content);
        that.viewModel.date(short.join('/'));
        that.viewModel.desc(data.photoset.description._content);
        that.promise.resolve();
    };

    /** 
     * Handle the photos from Flickr
     * @access private
     * @param {object} data The data returned from Flickr
     */
    handlePhotos = function (data) {
        var x, model, baseObj,
            y = data.photoset.total,
            models = [];

        for (x = 0; x < y; x += 1) {
            model = {};
            baseObj = data.photoset.photo[x];
            baseObj.size = that.options.imageSize;

            model.url = getImageUrl(baseObj);
            model.title = baseObj.title;
            model.originalIndex = x;
            models.push(model);
        }

        that.viewModel.photos(models);
        that.viewModel.originalLength = models.length;
    };

    /** 
     * Get the Flickr URL for a given photo
     * @access private
     * @param {object} photo A photo object
     * @return {string} The generated URL
     */
    getImageUrl = function (photo) {
        return ['http://farm', photo.farm, '.staticflickr.com/', photo.server, '/', photo.id, '_', photo.secret, '_', photo.size, '.jpg'].join('');
    };

    /** 
     * Sort the photos array items by the order received from Flickr
     * @access private
     */
    defaultSort = function () {
        that.viewModel.photos.sort(function (l, r) {
            return l.originalIndex === r.originalIndex ? 0 : (l.originalIndex < r.originalIndex) ? -1 : 1;
        });
    };

    /** 
     * Sort the photos array items by title
     * @access private
     */
    titleSort = function () {
        that.viewModel.photos.sort(function (l, r) {
            return l.title === r.title ? 0 : (l.title < r.title) ? -1 : 1;
        });
    };

    /** 
     * initialise the app
     * @access private
     */
    return (function () {

        // init
        managePromise();
        manageOptions();
        addWindowHandler();
        that.getPhotosetDetails();

        // view model
        that.viewModel = {
            title: ko.observable(),
            date: ko.observable(),
            desc: ko.observable(),
            showButton: ko.observable(false),
            photos: ko.observableArray(),
            filterTerm: ko.observable(),
            originalPhotos: null,
            originalLength: 0,
            lightboxVisible: ko.observable(false),
            lightbox: {
                title: null,
                url: null
            },
            sorts: ko.observableArray(that.options.sorts),
            sortHandler: function (item, e) {
                item.sorts()[e.target.selectedIndex].sorter();
            },
            stopEditing: function () {
                $('.editing').removeAttr('contentEditable').removeClass('editing');
            },
            makeEditable: function (data, e) {
                that.viewModel.stopEditing();
                $(e.target).attr('contentEditable', 'true').addClass('editing');
            },
            serialise: function () {
                var data = ko.toJS(that.viewModel);

                delete data.showButton;
                delete data.sorts;
                delete data.titleAndDate;

                data = JSON.stringify(data);
            },
            showLightbox: function (photo) {
                that.viewModel.lightbox.url = photo.url.replace(/_d/, '_b');
                that.viewModel.lightbox.title = photo.title;
                that.viewModel.lightboxVisible(true);
            },
            closeLightbox: function () {
                that.viewModel.lightbox.url = null;
                that.viewModel.lightbox.title = null;
                that.viewModel.lightboxVisible(false);
            }
        };

        that.viewModel.titleAndDate = ko.computed(function () {
            return [that.viewModel.title(), that.viewModel.date()].join(' ');
        });

        that.viewModel.filter = ko.computed(function () {
            var x,
                y = that.viewModel.photos().length,
                results = [],
                vm = that.viewModel,
                term = vm.filterTerm();

            if (term !== undefined && term !== '') {
                for (x = 0; x < y; x += 1) {
                    if (vm.photos()[x].title.indexOf(term) !== -1) {
                        results.push(vm.photos()[x]);
                    }
                }
                if (vm.photos().length === vm.originalLength) {
                    vm.originalPhotos = vm.photos();
                }
                vm.photos(results);
            } else if (term === '') {
                vm.photos(vm.originalPhotos);
            }
        });

        // custom contentEditable binding
        ko.bindingHandlers.editableContent = {
            init: function (el, valueAccessor) {
                var editable = $(el),
                    tagName = el.tagName;

                editable.on('keyup', function () {
                    var index,
                        text = editable.text(),
                        observable = valueAccessor();

                    if (tagName !== 'SPAN') {
                        observable(text);
                    } else {
                        index = editable.closest('figure').index();
                        that.viewModel.photos()[index].title = text;
                    }

                    that.viewModel.showButton(true);
                });
            },
            update: function (el, valueAccessor) {
                var val = valueAccessor();
                val = ko.utils.unwrapObservable(val);
                $(el).text(val);
            }
        };

        // go knockout!
        ko.applyBindings(that.viewModel);
    }());
}