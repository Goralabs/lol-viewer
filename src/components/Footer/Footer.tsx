import React from "react";
import './styles/footerStyle.css'

import {ReactComponent as GitHubLogoSVG} from '../../assets/images/github.svg';
import {ReactComponent as XLogoSVG} from '../../assets/images/x.svg';
import {ReactComponent as GoraLabsLogoSVG} from '../../assets/images/goralabslogo.svg';

export function Footer() {

    return (
        <nav className="footer-container">
            <a target="_blank" rel="noreferrer" href="https://github.com/Goralabs/lol-viewer" aria-label="GoRa Labs on GitHub">
                <GitHubLogoSVG className="footer-img"/>
            </a>
            <a target="_blank" rel="noreferrer" href="https://x.com/goralabs" aria-label="GoRa Labs on X">
                <XLogoSVG className="footer-img"/>
            </a>
            <a target="_blank" rel="noreferrer" href="https://goralabs.dev/" aria-label="GoRa Labs website">
                <GoraLabsLogoSVG className="footer-img footer-img--goralabs"/>
            </a>
        </nav>
    );
}
