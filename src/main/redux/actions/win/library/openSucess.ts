
// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { Action } from "readium-desktop/common/models/redux";

export const ID = "LIBRARY_OPEN_SUCCESS";

// tslint:disable-next-line: no-empty-interface
export interface Payload {
    win: Electron.BrowserWindow;
    identifier: string;
}

export function build(win: Electron.BrowserWindow, identifier: string):
    Action<typeof ID, Payload> {

    return {
        type: ID,
        payload: {
            win,
            identifier,
        },
    };
}
build.toString = () => ID; // Redux StringableActionCreator
export type TAction = ReturnType<typeof build>;
