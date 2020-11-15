import React from 'react';
import ReactDOM from 'react-dom';
import { PlayPage } from './pages/PlayPage';
import './index.css';
import { WalletProvider } from "./util/wallet";
import { useWallet } from "./util/wallet";

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

export function Header () {
    const { wallet, conn } = useWallet();
    return (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
            <a className="navbar-brand" href="https://www.solanaroll.com">SOLANA<i>ROLL</i></a>
        </nav>
    );
}

// ========================================

ReactDOM.render(
  <Game />,
  document.getElementById('root')
);
