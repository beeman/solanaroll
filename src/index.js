import React from 'react';
import ReactDOM from 'react-dom';
import { PlayPage } from './pages/PlayPage';
import { FundPage } from './pages/FundPage';
import './index.css';
import { WalletProvider } from "./util/wallet";
import { useWallet } from "./util/wallet";

import { BrowserRouter, Route, Switch, Redirect, useRouteMatch } from "react-router-dom";

class Game extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      history: [],
    };
  }
  render() {
    return (
      <div>
          <WalletProvider>
            <Header/>
            <PlayPage/>
          </WalletProvider>
      </div>
    );
  }
}

class Fund extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      history: [],
    };
  }
  render() {
    return (
      <div>
          <WalletProvider>
            <Header/>
            <FundPage/>
          </WalletProvider>
      </div>
    );
  }
}

export function Header () {
    const { wallet, conn } = useWallet();
    return (
        <div className="container">
            <nav className="navbar navbar-dark navbar-expand-lg bg-transparent">
                <div className="navbar-brand">
                    <a className=" d-inline-block align-top text-sr" href="https://www.solanaroll.com">Oneeye<i>King</i></a>
                </div>
                <button className="navbar-toggler bg-dark" type="button" data-toggle="collapse" data-target="#navbarText"
                        aria-controls="navbarText" aria-expanded="false" aria-label="Toggle navigation">
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse nav-menu-sr" id="navbarText">
                    <ul className="navbar-nav ml-auto">
                        <li className="nav-item active">
                            <a className="sr-nav-text-1 nav-link text-center sr-border-sm" href="/play">Play</a>
                        </li>
                        <li className="nav-item">
                            <a className="sr-nav-text-2 nav-link text-center sr-border-sm" href="/fund">Fund</a>
                        </li>
                    </ul>
                </div>
            </nav>
        </div>
    );
}

// ========================================

ReactDOM.render(

  <BrowserRouter>
      <Switch>
        <Route path="/" exact component={Game} />
        <Route path="/play" exact component={Game} />
        <Route path="/fund" exact component={Fund} />
        <Redirect from="*" to="/" exact />
      </Switch>
  </BrowserRouter>,
  document.getElementById('root')
);
