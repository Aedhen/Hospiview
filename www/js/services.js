'use strict';

/* Services */

angular.module('myApp.services', []).
        /**
         * Variable containing the base url.
         */
        constant('base_url', 'cfcs/webservices/reservations_service.cfc?').
                
        /**
         * Factory containing methods for the different requests.
         * 
         * @param {type} $http
         * @param {type} base_url
         * @returns {_L13.Anonym$1}.
         */
        factory('hospiviewFactory', function($http, base_url) {
            return{
                getHospiViewServerList: function() {
                    return $http.post("http://agenda.agendaview.be/cfcs/webservices/agendaview/hospiview_servers.cfc?method=GetHospiviewServerList");
                },
                getAuthentication: function(username, password, server_url) {
                    return $http.post(server_url + base_url + "method=GetAuthentication&user_login=" + username + "&user_password=" + password);
                },
                getUnitAndDepList: function(uuid, server_url) {
                    return $http.post(server_url + base_url + "method=GetUnitAndDepList&UUID=" + uuid);
                },
                getUnitDepGroups: function(uuid, server_url) {
                    return $http.post(server_url + base_url + "method=getUnitDepGroups&UUID=" + uuid);
                },
                getReservationsOnUnit: function(uuid, unit_id, dep_id, start_date, end_date, server_url) {
                    return $http.post(server_url + base_url + "method=GetReservationsOnUnit&UUID=" + uuid + "&unit_id=" + unit_id + "&dep_id=" + dep_id + "&start_date=" + start_date + "&end_date=" + end_date);
                },
                getReservationsOnPatient: function(uuid, pid_or_regno, patsearchvar, start_date, end_date, server_url) {
                    return $http.post(server_url + base_url + "method=GetReservationsOnPatient&UUID=" + uuid + "&pid_or_regno=" + pid_or_regno + "&patsearchvar=" + patsearchvar + "&start_date=" + start_date + "&end_date=" + end_date);
                },
                getPublicHolidays: function(Language_Id, year, month, server_url) {
                    return $http.post(server_url + base_url + "method=GetPublicHolidays&Language_Id=" + Language_Id + "&Year=" + year + "&Month=" + month);
                },
                getUnitAbsentDays: function(uuid, year, month, unit_id, server_url) {
                    return $http.post(server_url + base_url + "method=GetUnitAbsentDays&UUID=" + uuid + "&Year=" + year + "&Month=" + month + "&Unit_Id=" + unit_id);
                },
                getLanguageStrings: function(language_Id, listOfPidsSids, server_url){
                    return $http.post(server_url + base_url + "method=GetLanguageStrings&Language_Id=" + language_Id + "&ListOfPidsSids=" + listOfPidsSids);
                }

            };
        }).
        factory('dataFactory', function($rootScope, $q, hospiviewFactory) {
            return{
                /**
                 * Function that handles the resolved promise from hospiviewFactory.getPublicHolidays
                 * 
                 * @param {type} responses
                 * @returns {unresolved}
                 */
                setHolidays: function(responses) {
                    var defer = $q.defer();
                    for(var i=0;i<responses.length;i++){
                        var json = parseJson(responses[i].data);
                        if (json.PublicHolidays.Header.StatusCode == 1) {
                            if (!angular.isUndefined(json.PublicHolidays.Detail)) {
                                $rootScope.publicHolidays.push(json.PublicHolidays.Detail.PublicHoliday);
                            }
                        } else {
                            defer.reject($rootScope.getLocalizedString('internalError'));
                        }
                    }
                    defer.resolve();
                    localStorage.setItem($rootScope.user + "PublicHolidays", JSON.stringify($rootScope.publicHolidays));
                    return defer.promise;
                },
                /**
                 * Function that handles the resolved promise from hospiviewFactory.getUnitAndDepList
                 * 
                 * @param {type} response
                 * @returns {unresolved}
                 */
                setSearchUnits: function(response) {
                    var defer = $q.defer();
                    var json = parseJson(response.data);
                    if (json.UnitsAndDeps.Header.StatusCode == 1) {
                        var units = json.UnitsAndDeps.Detail.Unit;
                        for (var i = 0; i < units.length; i++) {
                            $rootScope.searchUnits.push(units[i]);
                        }
                        defer.resolve($rootScope.searchUnits);
                    } else {
                        defer.reject($rootScope.getLocalizedString('internalError'));
                    }
                    return defer.promise;
                },
                /**
                 * Requests every day where someone is absent and sets the data in the rootscope
                 * 
                 * @param {type} year
                 * @returns {unresolved}
                 */
                setAbsentDays: function(year) {
                    var defer = $q.defer(),
                            promises = [];

                    for (var i = 0; i < $rootScope.searchUnits.length; i++) {
                        promises.push(hospiviewFactory.getUnitAbsentDays($rootScope.currentServer.uuid, year, '00', $rootScope.searchUnits[i].Header.unit_id, $rootScope.currentServer.hosp_url));
                    }

                    $q.all(promises).then(function(responses) {
                        for (var j = 0; j < responses.length; j++) {
                            var json = parseJson(responses[j].data);
                            if (json.UnitAbsentdays.Header.StatusCode == 1) {
                                if (!angular.isUndefined(json.UnitAbsentdays.Detail)) {
                                    $rootScope.absentDays.push(json.UnitAbsentdays.Detail.AbsentDay);
                                }
                            } else {
                                defer.reject($rootScope.getLocalizedString('internalError'));
                            }
                        }
                        localStorage.setItem($rootScope.user + "AbsentDays", JSON.stringify($rootScope.absentDays));
                        defer.resolve();
                    }, function(error) {
                        defer.reject($rootScope.getLocalizedString('connectionError'));
                    });
                    return defer.promise;
                },
                /**
                 * Gets every reservation from the server and returns the data through 'var reservations'
                 * 
                 * @returns {unresolved}
                 */
                searchReservations: function() {
                    var defer = $q.defer(),
                            reservations = [],
                            promises = [];
                    for (var i = 0; i < $rootScope.searchUnits.length; i++) {
                        var depIds = [];
                        var unitId = $rootScope.searchUnits[i].Header.unit_id;

                        if ($rootScope.searchUnits[i].Header.perm === "1") {
                            depIds.push($rootScope.searchUnits[i].Detail.Dep[0].dep_id);
                        } else {
                            for (var j = 0; j < $rootScope.searchUnits[i].Detail.Dep.length; j++) {
                                depIds.push($rootScope.searchUnits[i].Detail.Dep[j].dep_id);
                            }
                        }

                        for (var k = 0; k < depIds.length; k++) {
                            promises.push(hospiviewFactory.getReservationsOnUnit($rootScope.currentServer.uuid, unitId, depIds[k], $rootScope.startDate, $rootScope.endDate, $rootScope.currentServer.hosp_url));
                        }
                    }
                    $q.all(promises).then(function(responses) {
                        for (var l = 0; l < responses.length; l++) {
                            var json = parseJson(responses[l].data);
                            if (!(angular.isUndefined(json.ReservationsOnUnit.Detail))) {
                                if (json.ReservationsOnUnit.Header.StatusCode === "1") {
                                    if (json.ReservationsOnUnit.Header.TotalRecords === "1") {
                                        reservations.push(json.ReservationsOnUnit.Detail.Reservation);
                                    } else {
                                        for (var s = 0; s < json.ReservationsOnUnit.Detail.Reservation.length; s++) {
                                            reservations.push(json.ReservationsOnUnit.Detail.Reservation[s]);
                                        }
                                    }

                                } else {
                                    defer.reject($rootScope.getLocalizedString('internalError'));
                                }
                            }
                        }
                        defer.resolve(reservations);
                    }, function(error) {
                        defer.reject($rootScope.getLocalizedString('connectionError'));
                    });
                    return defer.promise;
                },
                setSearchDates: function(startDate, endDate) {
                    startDate = new Date(startDate);
                    endDate = new Date(endDate);
                    /*startDate.setHours(0,0,0);
                    endDate.setHours(23,59,0);*/
                    if (angular.isUndefined($rootScope.searchRangeStart)) {
                        $rootScope.searchRangeStart = startDate;
                        localStorage.setItem($rootScope.user + "SearchRangeStart", startDate);
                    }
                    else {
                        if (new Date(startDate).getTime() < new Date($rootScope.searchRangeStart).getTime()) {
                            $rootScope.searchRangeStart = startDate;
                            localStorage.setItem($rootScope.user + "SearchRangeStart", startDate);
                        }
                    }
                    if (angular.isUndefined($rootScope.searchRangeEnd)) {
                        $rootScope.searchRangeEnd = endDate;
                        localStorage.setItem($rootScope.user + "SearchRangeEnd", endDate);
                    }
                    else {
                        if (new Date(endDate).getTime() > new Date($rootScope.searchRangeEnd).getTime()) {
                            $rootScope.searchRangeEnd = endDate;
                            localStorage.setItem($rootScope.user + "SearchRangeEnd", endDate);
                        }
                    }
                },
                /**
                 * Fills the calendar with the data set in the root scope
                 * 
                 */
                loadCalendar: function(){
                    var start = new Date($rootScope.searchRangeStart);
                    var end = new Date($rootScope.searchRangeEnd);
                    start.setHours(0, 0, 0);
                    end.setHours(0, 0, 0);
                    
                    var events = $rootScope[$rootScope.searchString];
                    var j = 0;
                    var count = 0;
                    var countEvent = [];
                    var eventsEdit = [];
                    while (start.getTime() !== end.getTime()) {
                        for (var i = 0; i < events.length; i++) {
                            eventsEdit.push(new Date(events[i].the_date));
                            eventsEdit[j].setHours(0, 0, 0);
                            if (start.getTime() === eventsEdit[j].getTime()) {
                                count = count + 1;
                            }
                            j = j + 1;
                        }
                        if (count != 0) {
                            count = count + "";
                            var endTest = new Date(start.getFullYear(), start.getMonth(), start.getDate(), start.getHours() + 1);
                            countEvent.push({title: count, start: start.toUTCString(), end: endTest.toUTCString(), allDay: true});
                            count = 0;
                        }
                        start.setDate(start.getDate() + 1);
                    }
                    
                    var holidays = $rootScope.publicHolidays[$rootScope.languageID-1];
                    if (!angular.isUndefined(holidays.length))
                        for (var i = 0; i < holidays.length; i++) {
                            var holiday_date = new Date(holidays[i].the_date);
                            var holiday_date_end = new Date(holiday_date.getFullYear(), holiday_date.getMonth(), holiday_date.getDate(), holiday_date.getHours() + 1);
                            countEvent.push({title: holidays[i].memo, start: holiday_date.toUTCString(), end: holiday_date_end, allDay: true, className: "calendarHoliday", color: "#E83131"});
                        }

                    var absentDays = $rootScope.absentDays;
                    if (!angular.isUndefined(absentDays.length))
                        for (var i = 0; i < absentDays.length; i++) {
                            for (var j = 0; j < absentDays[i].length; j++) {
                                if (!isHoliday(absentDays[i][j].the_date)) {
                                    var absent_date = new Date(absentDays[i][j].the_date);
                                    var absent_date_end = new Date(absent_date.getFullYear(), absent_date.getMonth(), absent_date.getDate(), absent_date.getHours() + 1);
                                    countEvent.push({title: $rootScope.getLocalizedString('appointmentsCalendarAbsent'), start: absent_date.toUTCString(), end: absent_date_end, allDay: true, className: "calendarAbsent", color: "#5F615D"});
                                }
                            }
                        }

                    function isHoliday(date) {
                        if (!angular.isUndefined(holidays.length))
                            for (var i = 0; i < holidays.length; i++) {
                                if (date === holidays[i].the_date)
                                    return true;
                            }
                        return false;
                    }
                    return countEvent;
                }
            };
        }).factory('languageFactory', function(hospiviewFactory, $q, $rootScope){
            /**
             * Gets a language string from a given array using its PID in combination with its SID
             * 
             * @param {type} langArray
             * @param {type} pid
             * @param {type} sid
             * @returns {Array|_L164.getStringByPidSid.langString}
             */
            function getStringByPidAndSid(langArray, pid, sid){
                for(var i=0;i<langArray.length;i++){
                    if(langArray[i].pid == pid && langArray[i].sid == sid) 
                        return langArray[i].string;
                }
            }
            return{
                /**
                 * Loads the language strings from remote data
                 * 
                 * @param {type} hosp_url
                 * @returns {unresolved}
                 */
                initRemoteLanguageStrings: function(hosp_url){
                    var listOfPidsSids = "204,1,2,3,4,5,6",
                        promises = [],
                        defer = $q.defer();
                    
                    for(var i=1;i<4;i++){
                        promises.push(hospiviewFactory.getLanguageStrings(i, listOfPidsSids, hosp_url));
                    }
                    
                    $q.all(promises).then(function(responses){
                        for(var j=0;j<responses.length;j++){
                            var json = parseJson(responses[j].data);
                            
                            if(json.LanguageStrings.Header.StatusCode === "1"){
                                var remoteDict = {
                                    createAppointmentGreeting: getStringByPidAndSid(json.LanguageStrings.Detail.LanguageString, 204, 1),
                                };
                                
                                switch(j){
                                    case 0:
                                        $rootScope.nlRemoteDict = remoteDict;
                                        break;
                                    case 1:
                                        $rootScope.frRemoteDict = remoteDict;
                                        break;
                                    case 2:
                                        $rootScope.enRemoteDict = remoteDict;
                                        break;
                                }
                                defer.resolve();
                            }else{
                                defer.reject($rootScope.getLocalizedString('internalError'));
                                break;
                            }
                        }
                    });
                    return defer.promise;
                }
               
            };
        });
