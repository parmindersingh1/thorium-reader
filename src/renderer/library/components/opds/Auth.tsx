// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as debug_ from "debug";
import * as React from "react";
import { connect } from "react-redux";
import { matchPath } from "react-router";
import {
    OPDS_AUTH_ENCRYPTION_IV_HEX, OPDS_AUTH_ENCRYPTION_KEY_HEX,
} from "readium-desktop/common/models/opds";
import { THttpGetOpdsResultView } from "readium-desktop/common/views/opds";
import * as styles from "readium-desktop/renderer/assets/styles/dialog.css";
import {
    TranslatorProps, withTranslator,
} from "readium-desktop/renderer/common/components/hoc/translator";
import { apiAction } from "readium-desktop/renderer/library/apiAction";
import { buildOpdsBrowserRoute } from "readium-desktop/renderer/library/opds/route";
import { ILibraryRootState } from "readium-desktop/renderer/library/redux/states";
import { dispatchHistoryPush, IOpdsBrowse, routes } from "readium-desktop/renderer/library/routing";
import { TMouseEventOnInput } from "readium-desktop/typings/react";
import { TDispatch } from "readium-desktop/typings/redux";

// tslint:disable-next-line: no-empty-interface
interface IBaseProps extends TranslatorProps {
    browserResult: THttpGetOpdsResultView;
}
// IProps may typically extend:
// RouteComponentProps
// ReturnType<typeof mapStateToProps>
// ReturnType<typeof mapDispatchToProps>
// tslint:disable-next-line: no-empty-interface
interface IProps extends IBaseProps,
    ReturnType<typeof mapStateToProps>, ReturnType<typeof mapDispatchToProps> {
}

interface IState {
    login: string | undefined;
    password: string | undefined;
}

// Logger
const debug = debug_("readium-desktop:renderer:library:Auth.tsx");

class OPDSAuth extends React.Component<IProps, IState> {

    constructor(props: IProps) {
        super(props);

        this.state = {
            login: undefined,
            password: undefined,
        };

        this.submit = this.submit.bind(this);
    }

    public render(): React.ReactElement<IProps> {
        const { login, password } = this.state;
        return (
            <section>
                <h2>{this.props.browserResult.data.title}</h2>
                {this.props.browserResult.data.auth.logoImageUrl && <><hr></hr><img
                    src={this.props.browserResult.data.auth.logoImageUrl}
                    role="presentation"
                    alt=""
                /><hr></hr></>}
                <form>
                    <div className={styles.field}>
                        <label>{this.props.browserResult.data.auth.labelLogin}</label>
                        <br></br>
                        <input
                            onChange={(e) => this.setState({
                                login: e.target.value,
                            })}
                            type="text"
                            aria-label={this.props.browserResult.data.auth.labelLogin}
                            placeholder={this.props.browserResult.data.auth.labelLogin}
                            defaultValue={login}
                        />
                    </div>
                    <br></br>
                    <div className={styles.field}>
                        <label>{this.props.browserResult.data.auth.labelPassword}</label>
                        <br></br>
                        <input
                            onChange={(e) => this.setState({
                                password: e.target.value,
                            })}
                            type="password"
                            aria-label={this.props.browserResult.data.auth.labelPassword}
                            placeholder={this.props.browserResult.data.auth.labelPassword}
                            defaultValue={password}
                        />
                    </div>
                    <br></br>
                    <div>
                        <input
                            disabled={!login || !password}
                                type="submit"
                                value={this.props.__("library.lcp.submit")}
                                onClick={this.submit}
                            />
                        </div>
                    </form>
            </section>
        );
    }

    public submit(e: TMouseEventOnInput) {
        e.preventDefault();

        function hexStrToArrayBuffer(hexStr: string) {
            return new Uint8Array(
                hexStr
                .match(/.{1,2}/g)
                .map((byte) => {
                    return parseInt(byte, 16);
                }),
            );
        }
        const textEncoder = new TextEncoder();
        const passwordEncoded = textEncoder.encode(this.state.password); // Uint8Array

        const keyPromise = window.crypto.subtle.importKey(
            "raw",
            hexStrToArrayBuffer(OPDS_AUTH_ENCRYPTION_KEY_HEX),
            { name: "AES-CBC", length: 256 },
            false,
            ["encrypt", "decrypt"],
        );
        keyPromise.then((key) => { // CryptoKey

            const iv = hexStrToArrayBuffer(OPDS_AUTH_ENCRYPTION_IV_HEX);
            const encryptedPasswordPromise = window.crypto.subtle.encrypt(
                {
                    name: "AES-CBC",
                    iv,
                },
                key,
                passwordEncoded,
            );
            encryptedPasswordPromise.then((encryptedPassword) => { // ArrayBuffer
                // const arg = String.fromCharCode.apply(null, new Uint8Array(encryptedPassword));
                const arg = new Uint8Array(encryptedPassword).reduce((data, byte) => {
                    return data + String.fromCharCode(byte);
                }, "");
                const encryptedPasswordB64 = window.btoa(arg);

                const url = this.props.browserResult.url.toString();
                apiAction("opds/oauth",
                    url,
                    this.state.login,
                    encryptedPasswordB64,
                    this.props.browserResult.data.auth.oauthUrl,
                    this.props.browserResult.data.auth.oauthRefreshUrl,
                    OPDS_AUTH_ENCRYPTION_KEY_HEX,
                    OPDS_AUTH_ENCRYPTION_IV_HEX)
                .then((okay) => {
                    if (okay) {
                        debug("SUCCESS fetch api opds/oauth");

                        const param = matchPath<IOpdsBrowse>(
                            this.props.location.pathname, routes["/opds/browse"],
                        ).params;
                        const lvl = parseInt(param.level, 10);
                        const i = (lvl > 1) ? (lvl - 1) : lvl;
                        const name = this.props.breadcrumb[i] && this.props.breadcrumb[i].name;
                        const route = buildOpdsBrowserRoute(
                            param.opdsId,
                            name,
                            url, // this.props.headerLinks?.self
                            lvl,
                        );

                        this.props.historyPush({
                            ...this.props.location,
                            pathname: route,
                            // state: {} // we preserve the existing route state
                        });
                    }
                })
                .catch((err) => {
                    console.error("Error to fetch api opds/oauth", err);
                });
            }, (err) => {
                debug(err);
            });
        }, (err) => {
            debug(err);
        });
    }
}

const mapStateToProps = (state: ILibraryRootState, _props: IBaseProps) => ({
    level: state.opds.browser.breadcrumb.length + 1,
    headerLinks: state.opds.browser.header,
    breadcrumb: state.opds.browser.breadcrumb,
    location: state.router.location,
});

const mapDispatchToProps = (dispatch: TDispatch, _props: IBaseProps) => ({
    historyPush: dispatchHistoryPush(dispatch),
});
export default connect(mapStateToProps, mapDispatchToProps)(withTranslator(OPDSAuth));
