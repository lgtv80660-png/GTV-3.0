// components/player/GPlayerFullscreen.ts


export class GPlayerFullscreen {


  private element:
    HTMLElement;



  private lastTap = 0;



  constructor(
    element:HTMLElement
  ){

    this.element =
      element;


    this.bind();

  }





  private bind(){


    this.element.addEventListener(
      "dblclick",
      () => {

        this.toggle();

      }
    );



    /*
      Android / tactile

      Double tap
    */


    this.element.addEventListener(
      "touchend",
      () => {


        const now =
          Date.now();



        if(
          now - this.lastTap
          < 300
        ){

          this.toggle();

        }



        this.lastTap =
          now;


      }
    );


  }







  async enter(){


    if(
      this.element.requestFullscreen
    ){

      await this.element
        .requestFullscreen();

    }


  }







  async exit(){


    if(
      document.fullscreenElement
    ){

      await document
        .exitFullscreen();

    }


  }







  async toggle(){


    if(
      document.fullscreenElement
    ){

      await this.exit();


    }
    else{


      await this.enter();


    }


  }







  isFullscreen(){

    return Boolean(
      document.fullscreenElement
    );

  }







  destroy(){


    this.element
      .replaceWith(
        this.element.cloneNode(true)
      );


  }


}