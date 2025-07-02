var jsonFiles, filesLength, fileKey = 0;

var projection = ol.proj.get('EPSG:3857');
var projectionExtent = projection.getExtent();
var size = ol.extent.getWidth(projectionExtent) / 256;
var resolutions = new Array(20);
var matrixIds = new Array(20);
for (var z = 0; z < 20; ++z) {
    resolutions[z] = size / Math.pow(2, z);
    matrixIds[z] = z;
}

var cityList = {};
var filterCity = '',
    filterTown = '';
var maxMonthlyFee = 20000;

var punishmentData = {};
var punishmentTerms = [];

function pointStyleFunction(f) {
    var p = f.getProperties(),
        color, stroke, radius, shadowColor;
    if (filterCity !== '' && p.city !== filterCity) {
        return null;
    }
    if (filterTown !== '' && p.town !== filterTown) {
        return null;
    }
    if (parseInt(p.monthly) > maxMonthlyFee) {
        return null;
    }

    var isSelected = f === currentFeature;
    var hasPenalty = p.penalty === '有';

    if (isSelected) {
        stroke = new ol.style.Stroke({
            color: '#007bff',
            width: 6
        });
        radius = 20;
        shadowColor = 'rgba(0, 123, 255, 0.5)';
    } else {
        stroke = new ol.style.Stroke({
            color: hasPenalty ? '#e74c3c' : '#ffffff',
            width: hasPenalty ? 3 : 2
        });
        radius = 12;
        shadowColor = hasPenalty ? 'rgba(231, 76, 60, 0.3)' : 'rgba(0, 0, 0, 0.2)';
    }

    if (!p.is_active) {
        color = '#95a5a6';
        shadowColor = 'rgba(149, 165, 166, 0.3)';
    } else {
        switch (p.type) {
            case '公立':
                color = '#27ae60';
                break;
            case '私立':
                if (p.pre_public !== '無') {
                    color = '#1abc9c';
                } else {
                    color = '#3498db';
                }
                break;
            case '非營利':
                color = '#f39c12';
                break;
            default:
                color = '#7f8c8d';
        }
    }

    let styles = [];

    if (isSelected) {
        let pulseStyle = new ol.style.Style({
            image: new ol.style.Circle({
                radius: radius + 8,
                fill: new ol.style.Fill({
                    color: 'rgba(0, 123, 255, 0.2)'
                }),
                stroke: new ol.style.Stroke({
                    color: 'rgba(0, 123, 255, 0.4)',
                    width: 2
                })
            }),
            zIndex: 998
        });
        styles.push(pulseStyle);
    }

    let pointStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius,
            fill: new ol.style.Fill({
                color: color
            }),
            stroke: stroke
        }),
        zIndex: isSelected ? 1000 : 100
    });
    styles.push(pointStyle);

    let innerDotStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: radius * 0.4,
            fill: new ol.style.Fill({
                color: 'rgba(255, 255, 255, 0.8)'
            })
        }),
        zIndex: isSelected ? 1001 : 101
    });
    styles.push(innerDotStyle);

    if (map.getView().getZoom() >= 13) {
        var textColor = '#2c3e50';
        var backgroundColor = 'rgba(255, 255, 255, 0.9)';

        if (map.getView().getZoom() >= 15) {
            pointStyle.setText(new ol.style.Text({
                font: 'bold 12px "Arial", sans-serif',
                fill: new ol.style.Fill({
                    color: textColor
                }),
                stroke: new ol.style.Stroke({
                    color: backgroundColor,
                    width: 3
                }),
                text: '$' + p.monthly.toString() + '/月',
                offsetY: radius + 15,
                textAlign: 'center',
                backgroundFill: new ol.style.Fill({
                    color: backgroundColor
                }),
                padding: [2, 4, 2, 4]
            }));
        } else {
            pointStyle.setText(new ol.style.Text({
                font: 'bold 10px "Arial", sans-serif',
                fill: new ol.style.Fill({
                    color: textColor
                }),
                stroke: new ol.style.Stroke({
                    color: backgroundColor,
                    width: 2
                }),
                text: '$' + (Math.round(p.monthly / 1000) * 1000).toString(),
                offsetY: radius + 12,
                textAlign: 'center'
            }));
        }
    }

    return styles;
}

var appView = new ol.View({
    center: ol.proj.fromLonLat([121.564101, 25.033493]),
    zoom: 14
});

var vectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON({
        featureProjection: appView.getProjection()
    })
});

$('select#city').change(function() {
    filterCity = $(this).val();
    var townOptions = '<option value="">--</option>';
    if (filterCity !== '') {
        for (town in cityList[filterCity]) {
            townOptions += '<option>' + town + '</option>';
        }
    }
    $('select#town').html(townOptions);
    filterTown = '';
    vectorSource.refresh();
});

$('select#town').change(function() {
    filterTown = $(this).val();
    vectorSource.refresh();
});

$('#monthlyFeeRange').on('input', function() {
    maxMonthlyFee = parseInt($(this).val()) || 0;
    $('#monthlyFeeValue').text(maxMonthlyFee);
    vectorSource.refresh();
});

$('#btn-geolocation').click(function() {
    var coordinates = geolocation.getPosition();
    if (coordinates) {
        appView.setCenter(coordinates);
        closeFilterPopup();
    } else {
        alert('目前使用的設備無法提供地理資訊');
    }
    return false;
});

var vectorPoints = new ol.layer.Vector({
    source: vectorSource,
    style: pointStyleFunction
});

var baseLayer = new ol.layer.Tile({
    source: new ol.source.WMTS({
        matrixSet: 'EPSG:3857',
        format: 'image/png',
        url: 'https://wmts.nlsc.gov.tw/wmts',
        layer: 'EMAP',
        tileGrid: new ol.tilegrid.WMTS({
            origin: ol.extent.getTopLeft(projectionExtent),
            resolutions: resolutions,
            matrixIds: matrixIds
        }),
        style: 'default',
        wrapX: true,
        attributions: '<a href="http://maps.nlsc.gov.tw/" target="_blank">國土測繪圖資服務雲</a>'
    }),
    opacity: 0.8
});

var map = new ol.Map({
    layers: [baseLayer, vectorPoints],
    target: 'map',
    view: appView
});

var pointClicked = false;
var isHashUpdate = false;

map.on('singleclick', function(evt) {
    pointClicked = false;
    map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
        if (false === pointClicked) {
            if (currentFeature && currentFeature !== feature) {
                currentFeature.setStyle(null);
                vectorSource.refresh();
            }

            currentFeature = feature;
            feature.setStyle(pointStyleFunction(feature));

            var p = feature.getProperties();

            showPopup(p, evt.pixel);

            var targetHash = '#' + p.id;
            if (window.location.hash !== targetHash) {
                isHashUpdate = true;
                window.location.hash = targetHash;
            }

            pointClicked = true;
        }
    });
});

var previousFeature = false;
var currentFeature = false;

var geolocation = new ol.Geolocation({
    projection: appView.getProjection()
});

geolocation.setTracking(true);

geolocation.on('error', function(error) {
    console.log(error.message);
});

var positionFeature = new ol.Feature();

positionFeature.setStyle(new ol.style.Style({
    image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({
            color: '#3399CC'
        }),
        stroke: new ol.style.Stroke({
            color: '#fff',
            width: 2
        })
    })
}));

var firstPosDone = false;
geolocation.on('change:position', function() {
    var coordinates = geolocation.getPosition();
    positionFeature.setGeometry(coordinates ? new ol.geom.Point(coordinates) : null);
    if (false === firstPosDone) {
        appView.setCenter(coordinates);
        firstPosDone = true;
    }
});

new ol.layer.Vector({
    map: map,
    source: new ol.source.Vector({
        features: [positionFeature]
    })
});

function showPopup(p, clickPixel) {
    console.log('showPopup called with:', p.title, 'clickPixel:', clickPixel);
    var popupTitle = document.getElementById('popupTitle');
    var popupInfo = document.getElementById('popupInfo');
    var popupOverlay = document.getElementById('popupOverlay');
    var popupContent = popupOverlay.querySelector('.popup-content');

    console.log('Popup elements found:', {
        popupTitle: !!popupTitle,
        popupInfo: !!popupInfo,
        popupOverlay: !!popupOverlay,
        popupContent: !!popupContent
    });

    popupTitle.innerHTML = p.title;

    var message = '<table class="table table-sm">';
    message += '<tbody>';

    if (p.owner) {
        message += '<tr><th scope="row" style="width: 120px;">負責人</th><td><a href="https://preschools.olc.tw/owners/' + p.owner + '" target="_blank" class="text-decoration-none">' + p.owner + '</a></td></tr>';
    }
    message += '<tr><th scope="row">電話</th><td>' + (p.tel || '未提供') + '</td></tr>';
    message += '<tr><th scope="row">住址</th><td>' + p.city + p.town + p.address + '</td></tr>';
    message += '<tr><td colspan="2"><button class="detail-button" onclick="window.open(\'https://preschools.olc.tw/preschools/view/' + p.id + '\', \'_blank\')">詳細資訊</button></td></tr>';

    if (p.type === '私立' && p.pre_public !== '無') {
        message += '<tr><th scope="row">類型</th><td>' + p.type + ' (準公共化)</td></tr>';
    } else {
        message += '<tr><th scope="row">類型</th><td>' + p.type + '</td></tr>';
    }

    if (p.pre_public && p.pre_public !== '無') {
        message += '<tr><th scope="row">準公共化</th><td>' + p.pre_public + '</td></tr>';
    }

    if (p.count_approved) {
        message += '<tr><th scope="row">核定人數</th><td>' + p.count_approved + ' 人</td></tr>';
    }

    if (p.size) {
        message += '<tr><th scope="row">全園總面積</th><td>' + p.size + '</td></tr>';
    }
    if (p.size_in) {
        message += '<tr><th scope="row">室內總面積</th><td>' + p.size_in + '</td></tr>';
    }
    if (p.size_out) {
        message += '<tr><th scope="row">室外活動空間</th><td>' + p.size_out + '</td></tr>';
    }
    if (p.floor) {
        message += '<tr><th scope="row">使用樓層</th><td>' + p.floor + '</td></tr>';
    }

    if (p.reg_date) {
        message += '<tr><th scope="row">核准設立日期</th><td>' + p.reg_date + '</td></tr>';
    }
    if (p.reg_no) {
        message += '<tr><th scope="row">設立許可證號</th><td>' + p.reg_no + '</td></tr>';
    }
    if (p.reg_docno) {
        message += '<tr><th scope="row">設立許可文號</th><td>' + p.reg_docno + '</td></tr>';
    }

    message += '<tr><th scope="row">每月收費</th><td><strong>$' + p.monthly + '</strong></td></tr>';

    if (p.is_free5 && p.is_free5 !== '無') {
        message += '<tr><th scope="row">五歲免費</th><td>' + p.is_free5 + '</td></tr>';
    }

    if (p.is_after && p.is_after !== '無') {
        message += '<tr><th scope="row">國小課後照顧</th><td>' + p.is_after + '</td></tr>';
    }

    if (p.shuttle && p.shuttle !== '無') {
        message += '<tr><th scope="row">幼童專用車</th><td>' + p.shuttle + '</td></tr>';
    }

    if (p.url && p.url !== '') {
        message += '<tr><th scope="row">網址</th><td><a href="' + p.url + '" target="_blank" class="text-decoration-none">' + p.url + '</a></td></tr>';
    }

    if (p.is_active !== undefined) {
        var statusText = p.is_active ? '營業中' : '已停業';
        var statusClass = p.is_active ? 'text-success' : 'text-danger';
        message += '<tr><th scope="row">營業狀態</th><td><span class="' + statusClass + '">' + statusText + '</span></td></tr>';
    }

    if (p.penalty) {
        var penaltyClass = p.penalty === '有' ? 'text-warning' : 'text-success';
        message += '<tr><th scope="row">裁罰記錄</th><td><span class="' + penaltyClass + '">' + p.penalty + '</span></td></tr>';
    }

    message += '</tbody></table>';

    popupInfo.innerHTML = message;

    console.log('Positioning popup, clickPixel provided:', !!clickPixel);
    if (clickPixel) {
        var mapElement = document.getElementById('map');
        var mapRect = mapElement.getBoundingClientRect();

        var markerX = clickPixel[0] + mapRect.left;
        var markerY = clickPixel[1] + mapRect.top;

        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        var popupWidth = 350;
        var popupHeight = 400;

        var x, y;
        var isOnLeft = false;

        x = markerX + 30;
        y = markerY - 20;

        if (x + popupWidth > viewportWidth) {
            x = markerX - popupWidth - 30;
            isOnLeft = true;
            popupContent.classList.add('arrow-right');
            popupContent.classList.remove('arrow-left');
        } else {
            popupContent.classList.add('arrow-left');
            popupContent.classList.remove('arrow-right');
        }

        if (y + popupHeight > viewportHeight) {
            y = viewportHeight - popupHeight - 20;
        }

        if (y < 20) {
            y = 20;
        }

        popupContent.style.left = x + 'px';
        popupContent.style.top = y + 'px';

        var connector = document.getElementById('popupConnector');
        if (!connector) {
            connector = document.createElement('div');
            connector.id = 'popupConnector';
            connector.className = 'popup-connector';
            popupOverlay.appendChild(connector);
        }

        var popupCenterX = x + (isOnLeft ? popupWidth : 0);
        var popupCenterY = y + 40;

        var deltaX = markerX - popupCenterX;
        var deltaY = markerY - popupCenterY;
        var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        var angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

        connector.style.left = Math.min(markerX, popupCenterX) + 'px';
        connector.style.top = Math.min(markerY, popupCenterY) + 'px';
        connector.style.width = distance + 'px';
        connector.style.height = '3px';
        connector.style.transformOrigin = '0 50%';
        connector.style.transform = 'rotate(' + angle + 'deg)';
        connector.style.display = 'block';
    }

    console.log('Setting popupOverlay display to block');
    console.log('Final popup position:', popupContent.style.left, popupContent.style.top);
    console.log('Popup overlay display style:', popupOverlay.style.display);
    popupOverlay.style.display = 'block';

    setTimeout(function() {
        var computedStyle = window.getComputedStyle(popupOverlay);
        console.log('Popup overlay computed display:', computedStyle.display);
        console.log('Popup overlay computed visibility:', computedStyle.visibility);
        console.log('Popup overlay computed z-index:', computedStyle.zIndex);
    }, 100);
}

function closePopup() {
    var popupOverlay = document.getElementById('popupOverlay');
    var connector = document.getElementById('popupConnector');

    popupOverlay.style.display = 'none';

    if (connector) {
        connector.style.display = 'none';
    }

    if (currentFeature) {
        currentFeature.setStyle(null);
        vectorSource.refresh();
        currentFeature = false;
    }
}

document.getElementById('popupOverlay').addEventListener('click', function(e) {
    console.log('Popup overlay clicked, target:', e.target, 'this:', this);
    console.log('Target class:', e.target.className);
    console.log('Closest popup-content:', e.target.closest('.popup-content'));

    if (e.target === this || !e.target.closest('.popup-content')) {
        console.log('Closing popup due to overlay click');
        closePopup();
    } else {
        console.log('Not closing popup - click was inside content');
    }
});

function openFilterPopup() {
    var filterPopup = document.getElementById('filterPopup');
    filterPopup.style.display = 'flex';
}

function closeFilterPopup() {
    var filterPopup = document.getElementById('filterPopup');
    filterPopup.style.display = 'none';
}

document.getElementById('filterPopup').addEventListener('click', function(e) {
    if (e.target === this) {
        closeFilterPopup();
    }
});

function showPos(lng, lat) {
    firstPosDone = true;
    appView.setCenter(ol.proj.fromLonLat([parseFloat(lng), parseFloat(lat)]));
}

var previousFeature = false;
var currentFeature = false;
var slipYears = ['113'];
var slipKeys = ['學費', '雜費', '材料費', '活動費', '午餐費', '點心費', '全學期總收費', '交通費', '課後延托費', '家長會費'];

function showPoint(pointId) {
    console.log('showPoint called with ID:', pointId);
    firstPosDone = true;
    var features = vectorPoints.getSource().getFeatures();
    console.log('Total features found:', features.length);
    var pointFound = false;
    for (k in features) {
        var p = features[k].getProperties();
        if (p.id === pointId) {
            console.log('Found matching feature:', p.title, 'with ID:', p.id);
            pointFound = true;

            if (isHashUpdate) {
                console.log('Skipping due to isHashUpdate flag');
                isHashUpdate = false;
                document.title = p.title + ' - 台灣幼兒園地圖';
                return;
            }

            console.log('Setting map center and zoom...');
            var targetFeature = features[k];
            var targetCoords = targetFeature.getGeometry().getCoordinates();

            appView.setCenter(targetCoords);
            appView.setZoom(15);

            setTimeout(function() {
                console.log('Timeout triggered, calculating pixel coordinates...');
                var pixel = map.getPixelFromCoordinate(targetCoords);
                console.log('Pixel coordinates:', pixel);

                if (currentFeature && currentFeature !== targetFeature) {
                    currentFeature.setStyle(null);
                    vectorSource.refresh();
                }

                currentFeature = targetFeature;
                targetFeature.setStyle(pointStyleFunction(targetFeature));

                var p = targetFeature.getProperties();
                console.log('About to call showPopup with:', p.title, 'ID:', p.id);
                showPopup(p, pixel);
                console.log('Popup should now be visible');
            }, 1000);

            document.title = p.title + ' - 台灣幼兒園地圖';
        }
    }
    if (!pointFound) {
        console.log('No feature found with ID:', pointId);
    }
}

var pointsFc;
var adminTree = {};
var findTerms = [];
$.getJSON('data/collection.json', {}, function(c) {
    pointsFc = c;
    var vFormat = vectorSource.getFormat();
    vectorSource.addFeatures(vFormat.readFeatures(pointsFc));

    var maxFee = 0;
    for (k in pointsFc.features) {
        var p = pointsFc.features[k].properties;
        var monthlyFee = parseInt(p.monthly);
        if (!isNaN(monthlyFee) && monthlyFee > maxFee) {
            maxFee = monthlyFee;
        }
        findTerms.push({
            value: p.id,
            label: p.title + '(' + p.owner + ') ' + p.address
        });
        if (!cityList[p.city]) {
            cityList[p.city] = {};
        }
        if (!cityList[p.city][p.town]) {
            ++cityList[p.city][p.town];
        }
    }
    var cityOptions = '<option value="">--</option>';
    for (city in cityList) {
        cityOptions += '<option>' + city + '</option>';
    }
    $('select#city').html(cityOptions);

    $('#monthlyFeeRange').attr('max', maxFee);
    $('#monthlyFeeRange').val(maxFee);
    $('#monthlyFeeValue').text(maxFee);
    maxMonthlyFee = maxFee;

    routie(':pointId', showPoint);
    routie('pos/:lng/:lat', showPos);

    if (window.location.hash) {
        var pointId = window.location.hash.substring(1);
        if (pointId) {
            setTimeout(function() {
                showPoint(pointId);
            }, 100);
        }
    }

    $('#findPoint').autocomplete({
        source: findTerms,
        select: function(event, ui) {
            var targetHash = '#' + ui.item.value;
            if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
            closeFilterPopup();
        }
    });
});
var vehicles = {};
$.getJSON('data/vehicles.json', {}, function(c) {
    vehicles = c;
});

$.getJSON('data/punish_all.json', {}, function(data) {
    punishmentData = data;
    for (let key in data) {
        for (let punishment of data[key]) {
            punishmentTerms.push({
                value: punishment.id,
                label: punishment.date + key + ' - ' + punishment.punishment + '(' + punishment.law + ')'
            });
        }
    }

    $('#findPunish').autocomplete({
        source: punishmentTerms,
        select: function(event, ui) {
            var targetHash = '#' + ui.item.value;
            if (window.location.hash !== targetHash) {
                window.location.hash = targetHash;
            }
            closeFilterPopup();
        }
    });
});

function toggleLegend() {
    var legend = document.getElementById('mapLegend');
    var toggleBtn = legend.querySelector('.legend-toggle');

    if (legend.classList.contains('collapsed')) {
        legend.classList.remove('collapsed');
        toggleBtn.textContent = '−';
    } else {
        legend.classList.add('collapsed');
        toggleBtn.textContent = '+';
    }
}