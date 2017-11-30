/*
 * Copyright © 2016-2017 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import 'angular-material-data-table/dist/md-data-table.min.css';
import './extension-table.scss';

/* eslint-disable import/no-unresolved, import/default */

import extensionTableTemplate from './extension-table.tpl.html';
import extensionDialogTemplate from './extension-dialog.tpl.html';

/* eslint-enable import/no-unresolved, import/default */

import ExtensionDialogController from './extension-dialog.controller'

/*@ngInject*/
export default function ExtensionTableDirective() {
    return {
        restrict: "E",
        scope: true,
        bindToController: {
            entityId: '=',
            entityType: '@'
        },
        controller: ExtensionTableController,
        controllerAs: 'vm',
        templateUrl: extensionTableTemplate
    };
}

/*@ngInject*/
function ExtensionTableController($scope, $filter, $document, $translate, types, $mdDialog, attributeService, telemetryWebsocketService) {

    let vm = this;

    vm.extensions = [];
    vm.allExtensions = [];
    vm.selectedExtensions = [];
    vm.extensionsCount = 0;

    vm.query = {
        order: 'id',
        limit: 5,
        page: 1,
        search: null
    };

    vm.enterFilterMode = enterFilterMode;
    vm.exitFilterMode = exitFilterMode;
    vm.onReorder = onReorder;
    vm.onPaginate = onPaginate;
    vm.addExtension = addExtension;
    vm.editExtension = editExtension;
    vm.deleteExtension = deleteExtension;
    vm.deleteExtensions = deleteExtensions;
    vm.reloadExtensions = reloadExtensions;
    vm.updateExtensions = updateExtensions;


    $scope.$watch("vm.entityId", function(newVal) {
        if (newVal) {
            reloadExtensions();
        }
    });

    $scope.$watch("vm.query.search", function(newVal, prevVal) {
        if (!angular.equals(newVal, prevVal) && vm.query.search != null) {
            updateExtensions();
        }
    });

    function enterFilterMode() {
        vm.query.search = '';
    }

    function exitFilterMode() {
        vm.query.search = null;
        updateExtensions();
    }

    function onReorder() {
        updateExtensions();
    }

    function onPaginate() {
        updateExtensions();
    }

    function addExtension($event) {
        if ($event) {
            $event.stopPropagation();
        }
        openExtensionDialog($event);
    }

    function editExtension($event, extension) {
        if ($event) {
            $event.stopPropagation();
        }
        openExtensionDialog($event, extension);
    }

    function openExtensionDialog($event, extension) {
        if ($event) {
            $event.stopPropagation();
        }
        var isAdd = false;
        if(!extension) {
            isAdd = true;
        }
        $mdDialog.show({
            controller: ExtensionDialogController,
            controllerAs: 'vm',
            templateUrl: extensionDialogTemplate,
            parent: angular.element($document[0].body),
            locals: {
                isAdd: isAdd,
                allExtensions: vm.allExtensions,
                entityId: vm.entityId,
                entityType: vm.entityType,
                extension: extension
            },
            bindToController: true,
            targetEvent: $event,
            fullscreen: true,
            skipHide: true
        }).then(function() {
            reloadExtensions();
        }, function () {
        });
    }

    function deleteExtension($event, extension) {
        if ($event) {
            $event.stopPropagation();
        }
        if(extension) {
            var title = $translate.instant('extension.delete-extension-title', {extensionId: extension.id});
            var content = $translate.instant('extension.delete-extension-text');

            var confirm = $mdDialog.confirm()
                .targetEvent($event)
                .title(title)
                .htmlContent(content)
                .ariaLabel(title)
                .cancel($translate.instant('action.no'))
                .ok($translate.instant('action.yes'));
            $mdDialog.show(confirm).then(function() {
                var editedExtensions = vm.allExtensions.filter(function(ext) {
                    return ext.id !== extension.id;
                });
                var editedValue = angular.toJson(editedExtensions);
                attributeService.saveEntityAttributes(vm.entityType, vm.entityId, types.attributesScope.shared.value, [{key:"configuration", value:editedValue}]).then(
                    function success() {
                        reloadExtensions();
                    }
                );
            });
        }
    }

    function deleteExtensions($event) {
        if ($event) {
            $event.stopPropagation();
        }
        if (vm.selectedExtensions && vm.selectedExtensions.length > 0) {
            var title = $translate.instant('extension.delete-extensions-title', {count: vm.selectedExtensions.length}, 'messageformat');
            var content = $translate.instant('extension.delete-extensions-text');

            var confirm = $mdDialog.confirm()
                .targetEvent($event)
                .title(title)
                .htmlContent(content)
                .ariaLabel(title)
                .cancel($translate.instant('action.no'))
                .ok($translate.instant('action.yes'));
            $mdDialog.show(confirm).then(function () {
                var editedExtensions = angular.copy(vm.allExtensions);
                for (var i = 0; i < vm.selectedExtensions.length; i++) {
                    editedExtensions = editedExtensions.filter(function (ext) {
                        return ext.id !== vm.selectedExtensions[i].id;
                    });
                }
                var editedValue = angular.toJson(editedExtensions);
                attributeService.saveEntityAttributes(vm.entityType, vm.entityId, types.attributesScope.shared.value, [{key:"configuration", value:editedValue}]).then(
                    function success() {
                        reloadExtensions();
                    }
                );
            });
        }
    }

    function reloadExtensions() {
        vm.allExtensions.length = 0;
        vm.extensions.length = 0;
        vm.extensionsPromise = attributeService.getEntityAttributesValues(vm.entityType, vm.entityId, types.attributesScope.shared.value, ["configuration"]);
        vm.extensionsPromise.then(
            function success(data) {
                vm.allExtensions = angular.fromJson(data[0].value);
                vm.selectedExtensions = [];
                updateExtensions();
                vm.extensionsPromise = null;
            },
            function fail() {
                vm.extensions = [];
                vm.selectedExtensions = [];
                updateExtensions();
                vm.extensionsPromise = null;
            }
        );
    }

    function updateExtensions() {
        vm.selectedExtensions = [];
        var result = $filter('orderBy')(vm.allExtensions, vm.query.order);
        if (vm.query.search != null) {
            result = $filter('filter')(result, function(extension) {
                if(!vm.query.search || (extension.id.indexOf(vm.query.search) != -1) || (extension.type.indexOf(vm.query.search) != -1)) {
                    return true;
                }
                return false;
            });
        }
        vm.extensionsCount = result.length;
        var startIndex = vm.query.limit * (vm.query.page - 1);
        vm.extensions = result.slice(startIndex, startIndex + vm.query.limit);
        vm.extensionsJSON = angular.toJson(vm.extensions);
    }



    if (vm.entityId && vm.entityType) {
        $scope.subscriber = {
            subscriptionCommands: [{
                entityType: vm.entityType,
                entityId: vm.entityId,
                scope: 'CLIENT_SCOPE'
            }],
            type: 'attribute',
            onData: function (data) {
                if (data.data) {
                    onSubscriptionData(data.data);
                }
            }
        };
    }
    telemetryWebsocketService.subscribe($scope.subscriber);


    $scope.$on('$destroy', function() {
        telemetryWebsocketService.unsubscribe($scope.subscriber);
    });




    function onSubscriptionData(data) {
        if (data.appliedConfiguration && data.appliedConfiguration[0] && data.appliedConfiguration[0][1]) {
            vm.appliedConfiguration = data.appliedConfiguration[0][1];
            checkForSync();
            $scope.$digest();
        }
    }


    checkForSync();
    function checkForSync() {
        if (vm.appliedConfiguration === vm.extensionsJSON) {
            vm.syncStatus = $translate.instant('extension.sync.sync');
            vm.syncLastTime = formatDate();
        } else {
            vm.syncStatus = $translate.instant('extension.sync.not-sync');
        }
    }

    function formatDate(date) {
        let d;
        if (date) {
            d = date;
        } else {
            d = new Date();
        }

        d = d.getFullYear() +'/'+ addZero(d.getMonth()+1) +'/'+ addZero(d.getDate()) + ' ' + addZero(d.getHours()) + ':' + addZero(d.getMinutes()) +':'+ addZero(d.getSeconds());
        return d;


        function addZero(num) {
            if ((angular.isNumber(num) && num < 10) || (angular.isString(num) && num.length === 1)) {
                num = '0' + num;
            }
            return num;
        }
    }


    //telemetryWebsocketService.subscribe(subscriber);
}